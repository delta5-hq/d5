import {getLLM} from '../../commands/utils/langchain/getLLM'
import {HumanMessage} from '@langchain/core/messages'
import ModelFamilyRouter from '../models/ModelFamilyRouter'
import ShuffleMapper from './ShuffleMapper'
import serializeNodeTree from '../../commands/utils/serializeNodeTree'

/**
 * Provides semantic evaluation beyond structural validation (β≈0.15)
 * Eliminates positional bias through presentation order randomization
 */
class LLMJudge {
  /**
   * @typedef {Object} JudgmentResult
   * @property {number} winnerIndex
   * @property {string|null} reason
   */

  /**
   * @param {string} prompt - Original user prompt
   * @param {Array<import('../../commands/utils/Store').default>} candidates
   * @param {string} generatorFamily
   * @param {Object} settings - User integration settings
   * @param {Object} [options] - Evaluation options
   * @param {function(number): Object} [options.shuffleMapperFactory] - Injectable shuffle factory for testing
   * @param {string} [options.criteria] - User-provided validation criteria
   * @returns {Promise<JudgmentResult>}
   */
  static async evaluate(prompt, candidates, generatorFamily, settings, options = {}) {
    const judgeFamily = ModelFamilyRouter.selectJudgeModel(generatorFamily, settings)

    if (!judgeFamily) {
      return {
        winnerIndex: 0,
        reason: 'no_alternative_model_available',
      }
    }

    const {shuffleMapperFactory = ShuffleMapper.createShuffleMapping, criteria} = options
    const shuffle = shuffleMapperFactory(candidates.length)

    try {
      const {llm} = getLLM({type: judgeFamily, settings})

      const serialized = shuffle.presentationOrder.map((originalIdx, presentIdx) =>
        this.serializeCandidate(candidates[originalIdx], presentIdx + 1),
      )

      const judgePrompt = this.buildJudgePrompt(prompt, serialized, candidates.length, criteria)

      const result = await llm.invoke([new HumanMessage(judgePrompt)])

      const {index, reason} = this.parseJudgeResponse(result.content, candidates.length)
      if (index !== null) {
        return {
          winnerIndex: shuffle.remapToOriginal(index - 1),
          reason: null,
        }
      }

      return {winnerIndex: 0, reason}
    } catch (error) {
      return {
        winnerIndex: 0,
        reason: 'judge_invocation_failed',
      }
    }
  }

  /**
   * Tolerates verbose judge phrasing (e.g. "Candidate 2 is best") in addition to bare integers.
   * Ambiguous when multiple distinct in-range integers appear — returns null to force fallback.
   *
   * @param {string|null|undefined} content
   * @param {number} candidateCount
   * @returns {{index: number|null, reason: string|null}}
   */
  static parseJudgeResponse(content, candidateCount) {
    const trimmed = content?.trim() ?? ''

    if (!trimmed) {
      return {index: null, reason: 'unparseable_judge_response'}
    }

    const direct = parseInt(trimmed, 10)
    if (!Number.isNaN(direct) && direct >= 1 && direct <= candidateCount && String(direct) === trimmed) {
      return {index: direct, reason: null}
    }

    const unique = [
      ...new Set(
        [...trimmed.matchAll(/\b(\d+)\b/g)].map(m => parseInt(m[1], 10)).filter(n => n >= 1 && n <= candidateCount),
      ),
    ]

    if (unique.length === 1) {
      return {index: unique[0], reason: null}
    }

    return {index: null, reason: 'unparseable_judge_response'}
  }

  /** @private */
  static serializeCandidate(store, candidateNumber) {
    const output = store.getOutput()
    const tree = serializeNodeTree(output.nodes, store._nodes)

    return `Candidate ${candidateNumber}:\n${tree || '(empty)'}`
  }

  /** @private */
  static buildJudgePrompt(originalPrompt, serializedCandidates, candidateCount, criteria) {
    const baseInstruction = `You are evaluating LLM outputs. Given the original prompt and ${candidateCount} candidate responses, respond with ONLY the number (1-${candidateCount}) of the best candidate. No explanation.`

    const criteriaSection =
      criteria && criteria.trim() ? `\n\nEvaluate candidates against these criteria:\n${criteria}` : ''

    return `${baseInstruction}${criteriaSection}

Original prompt: ${originalPrompt}

${serializedCandidates.join('\n\n')}`
  }
}

export default LLMJudge

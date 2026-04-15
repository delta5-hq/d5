import {getLLM} from '../../commands/utils/langchain/getLLM'
import {HumanMessage} from '@langchain/core/messages'
import ModelFamilyRouter from '../models/ModelFamilyRouter'
import ShuffleMapper from './ShuffleMapper'

/**
 * LLM-based quality judge for selecting best candidate
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
   * Evaluate candidates and select best one
   *
   * @param {string} prompt - Original user prompt
   * @param {Array<import('../../commands/utils/Store').default>} candidates
   * @param {string} generatorFamily
   * @param {Object} settings - User integration settings
   * @param {Object} [options] - Evaluation options
   * @param {function(number): Object} [options.shuffleMapperFactory] - Injectable shuffle factory for testing
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

    const shuffleMapperFactory = options.shuffleMapperFactory || ShuffleMapper.createShuffleMapping
    const shuffle = shuffleMapperFactory(candidates.length)

    try {
      const {llm} = getLLM({type: judgeFamily, settings})

      const serialized = shuffle.presentationOrder.map((originalIdx, presentIdx) =>
        this.serializeCandidate(candidates[originalIdx], presentIdx + 1),
      )

      const judgePrompt = this.buildJudgePrompt(prompt, serialized, candidates.length)

      const result = await llm.invoke([new HumanMessage(judgePrompt)])
      const content = result.content?.trim()

      const parsed = parseInt(content, 10)
      if (parsed >= 1 && parsed <= candidates.length) {
        return {
          winnerIndex: shuffle.remapToOriginal(parsed - 1),
          reason: null,
        }
      }

      return {
        winnerIndex: 0,
        reason: 'unparseable_judge_response',
      }
    } catch (error) {
      return {
        winnerIndex: 0,
        reason: 'judge_invocation_failed',
      }
    }
  }

  /**
   * @private
   */
  static serializeCandidate(store, candidateNumber) {
    const output = store.getOutput()
    const tree = this.serializeNodeTree(output.nodes, store._nodes)

    return `Candidate ${candidateNumber}:\n${tree || '(empty)'}`
  }

  /**
   * @private
   */
  static serializeNodeTree(outputNodes, allNodes) {
    const lines = []
    const roots = outputNodes.filter(node => {
      const hasParentInOutput = outputNodes.some(other => other.id === node.parent)
      return !hasParentInOutput
    })

    const walk = (node, depth) => {
      const title = node.title || (node.gridOptions ? '(table)' : '(untitled)')
      lines.push('  '.repeat(depth) + title)

      const children = (node.children || []).map(id => allNodes[id]).filter(Boolean)
      children.forEach(child => walk(child, depth + 1))
    }

    roots.forEach(root => walk(root, 0))

    return lines.join('\n')
  }

  /**
   * @private
   */
  static buildJudgePrompt(originalPrompt, serializedCandidates, candidateCount) {
    return `You are evaluating LLM outputs. Given the original prompt and ${candidateCount} candidate responses, respond with ONLY the number (1-${candidateCount}) of the best candidate. No explanation.

Original prompt: ${originalPrompt}

${serializedCandidates.join('\n\n')}`
  }
}

export default LLMJudge

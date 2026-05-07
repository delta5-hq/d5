import {getLLM, Model} from '../../commands/utils/langchain/getLLM'
import {HumanMessage} from '@langchain/core/messages'
import ModelFamilyRouter from '../models/ModelFamilyRouter'
import ShuffleMapper from './ShuffleMapper'
import VoteAggregator from './VoteAggregator'
import {JudgeErrorClassifier, JudgeNonTransientError} from './JudgeErrorClassifier'
import serializeNodeTree from '../../commands/utils/serializeNodeTree'

const DEEPSEEK_REASONER_MODEL = 'deepseek-reasoner'

class LLMJudge {
  /**
   * @typedef {Object} JudgmentResult
   * @property {number} winnerIndex
   * @property {number|null} confidence
   * @property {string|null} reason
   */

  /**
   * @param {string} prompt
   * @param {Array} candidates
   * @param {string} generatorFamily
   * @param {Object} settings
   * @param {Object} [options]
   * @param {string|null} [options.judgeFamily]
   * @param {boolean} [options.judgeReasoning]
   * @param {number} [options.judgeSamples]
   * @param {number} [options.judgeEnsemble]
   * @param {function} [options.shuffleMapperFactory]
   * @param {string} [options.criteria]
   * @returns {Promise<JudgmentResult>}
   */
  static async evaluate(prompt, candidates, generatorFamily, settings, options = {}) {
    const {
      judgeFamily: overrideFamily = null,
      judgeReasoning = false,
      judgeSamples = 1,
      judgeEnsemble = 1,
      shuffleMapperFactory = ShuffleMapper.createShuffleMapping,
      criteria,
    } = options

    const families = ModelFamilyRouter.selectJudgeModels(generatorFamily, settings, judgeEnsemble, overrideFamily)

    if (families.length === 0) {
      return {winnerIndex: 0, confidence: null, reason: 'no_alternative_model_available'}
    }

    const allVoteSettled = await Promise.allSettled(
      families.map(family =>
        this.collectSamplesForFamily(
          prompt,
          candidates,
          family,
          settings,
          judgeSamples,
          judgeReasoning,
          shuffleMapperFactory,
          criteria,
        ),
      ),
    )

    const flatVotes = allVoteSettled.filter(r => r.status === 'fulfilled').flatMap(r => r.value)

    if (flatVotes.length === 0) {
      const nonTransientRejection = allVoteSettled.find(
        r => r.status === 'rejected' && r.reason instanceof JudgeNonTransientError,
      )
      const reason = nonTransientRejection ? nonTransientRejection.reason.reason : 'all_judge_calls_failed'
      return {winnerIndex: 0, confidence: null, reason}
    }

    const winnerIndex = VoteAggregator.majority(flatVotes, candidates.length)
    const confidence = VoteAggregator.confidence(flatVotes, candidates.length)

    return {winnerIndex, confidence, reason: null}
  }

  /** @private */
  static async collectSamplesForFamily(
    prompt,
    candidates,
    family,
    settings,
    sampleCount,
    judgeReasoning,
    shuffleMapperFactory,
    criteria,
  ) {
    const votes = []
    for (let i = 0; i < sampleCount; i++) {
      try {
        const vote = await this.singleJudgeCall(
          prompt,
          candidates,
          family,
          settings,
          judgeReasoning,
          shuffleMapperFactory,
          criteria,
        )
        if (vote !== null) votes.push(vote)
      } catch (error) {
        const nonTransient = JudgeErrorClassifier.wrapIfNonTransient(error)
        if (nonTransient) throw nonTransient
      }
    }
    return votes
  }

  /** @private */
  static async singleJudgeCall(prompt, candidates, family, settings, judgeReasoning, shuffleMapperFactory, criteria) {
    const shuffle = shuffleMapperFactory(candidates.length)
    const {llm} = this.createJudgeLLM(family, settings, judgeReasoning)

    const serialized = shuffle.presentationOrder.map((originalIdx, presentIdx) =>
      this.serializeCandidate(candidates[originalIdx], presentIdx + 1),
    )

    const judgePrompt = this.buildJudgePrompt(prompt, serialized, candidates.length, criteria)
    const result = await llm.invoke([new HumanMessage(judgePrompt)])
    const {index} = this.parseJudgeResponse(result.content, candidates.length)

    if (index === null) return null
    return shuffle.remapToOriginal(index - 1)
  }

  /** @private */
  static createJudgeLLM(family, settings, judgeReasoning) {
    if (!judgeReasoning) {
      return getLLM({type: family, settings})
    }

    if (family === Model.Deepseek) {
      return getLLM({
        type: family,
        settings: {
          ...settings,
          deepseek: {...(settings?.deepseek ?? {}), model: DEEPSEEK_REASONER_MODEL},
        },
      })
    }

    if (family === Model.Claude) {
      return getLLM({type: family, settings, thinkingBudgetTokens: 2000})
    }

    return getLLM({type: family, settings})
  }

  // Accepts verbose LLM phrasing; returns null when no single unambiguous in-range integer is found.
  /** @private */
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

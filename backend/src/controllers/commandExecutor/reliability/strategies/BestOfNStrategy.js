import CandidateEvaluator from '../core/CandidateEvaluator'
import StoreFork from '../core/StoreFork'
import LLMJudge from '../core/LLMJudge'
import {stripReliabilitySuffix, buildGateFailureSuffix, buildJudgmentSuffix} from '../core/reliabilitySuffix'

class BestOfNStrategy {
  static async execute(commandExecutor, store, cellId, prompt, N, options = {}) {
    const {
      isTableCommand = false,
      generatorFamily,
      settings,
      criteria,
      judgeFamily = null,
      judgeReasoning = false,
      judgeSamples = 1,
      judgeEnsemble = 1,
    } = options

    const originalTitle = stripReliabilitySuffix(store._nodes?.[cellId]?.title || '')
    let suffix = buildGateFailureSuffix(N)

    try {
      const candidatePromises = Array.from({length: N}, async () => {
        const fork = StoreFork.createFork(store)
        try {
          await commandExecutor(fork)
          const validation = CandidateEvaluator.validate(fork, prompt, {isTableCommand})
          return validation.pass ? fork : null
        } catch {
          return null
        }
      })

      const results = await Promise.allSettled(candidatePromises)
      const candidates = results.filter(r => r.status === 'fulfilled' && r.value !== null).map(r => r.value)

      if (candidates.length === 0) {
        return
      }

      const judgment =
        candidates.length >= 2
          ? await LLMJudge.evaluate(prompt, candidates, generatorFamily, settings, {
              criteria,
              judgeFamily,
              judgeReasoning,
              judgeSamples,
              judgeEnsemble,
            })
          : {winnerIndex: 0, confidence: null, reason: null}

      StoreFork.applyCandidate(store, candidates[judgment.winnerIndex], cellId)

      suffix = buildJudgmentSuffix(judgment, candidates.length, N)
    } finally {
      const cellNode = store._nodes?.[cellId]
      if (cellNode) {
        cellNode.title = `${originalTitle} ${suffix}`.trim()
      }
    }
  }
}

export default BestOfNStrategy

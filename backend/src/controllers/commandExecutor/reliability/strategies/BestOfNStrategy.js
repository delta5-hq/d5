import CandidateEvaluator from '../core/CandidateEvaluator'
import StoreFork from '../core/StoreFork'
import LLMJudge from '../core/LLMJudge'

/**
 * N-redundant execution with gated selection
 * Phase 2: Structural gate (β≈0) + LLM judge (β≈0.15) for multi-candidate selection
 */
class BestOfNStrategy {
  /**
   * Execute command N times on isolated forks and select best candidate
   *
   * @param {Function} commandExecutor - Async function that executes command on given store
   * @param {import('../../commands/utils/Store').default} store
   * @param {string} cellId
   * @param {string} prompt
   * @param {number} N
   * @param {Object} options
   * @param {boolean} [options.isTableCommand]
   * @param {string} options.generatorFamily
   * @param {Object} options.settings - User integration settings
   * @returns {Promise<void>}
   */
  static async execute(commandExecutor, store, cellId, prompt, N, options = {}) {
    const {isTableCommand = false, generatorFamily, settings} = options

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
      throw new Error('All candidates failed structural validation')
    }

    let winner

    if (candidates.length === 1) {
      winner = candidates[0]
    } else {
      const judgment = await LLMJudge.evaluate(prompt, candidates, generatorFamily, settings)
      winner = candidates[judgment.winnerIndex]
    }

    StoreFork.applyCandidate(store, winner, cellId)
  }
}

export default BestOfNStrategy

import CandidateEvaluator from '../core/CandidateEvaluator'
import StoreFork from '../core/StoreFork'
import LLMJudge from '../core/LLMJudge'

/**
 * N-redundant execution with gated selection
 * Phase 2: Structural gate (β≈0) + LLM judge (β≈0.15) for multi-candidate selection
 */
class BestOfNStrategy {
  /** @private */
  static stripBestOfSuffix(title) {
    if (!title) return ''
    return title.replace(/\s*\[[✓✗]\s+\d+\/\d+\s+(best\s+of\s+\d+|passed)\]\s*$/i, '')
  }

  /**
   * Execute N-redundant best-of-N sampling with two-layer gated selection
   *
   * @param {Function} commandExecutor - Async function (store) => Promise<void> that runs the LLM command
   * @param {Store} store - Target store to merge winner into
   * @param {string} cellId - ID of the command cell for title suffix annotation
   * @param {string} prompt - Original user prompt for judge evaluation
   * @param {number} N - Number of parallel candidates to generate (N ≥ 1)
   * @param {Object} options - Configuration options
   * @param {boolean} [options.isTableCommand=false] - Enable table-specific structural validation
   * @param {string} [options.generatorFamily] - LLM family of generator model (e.g., 'anthropic')
   * @param {Object} [options.settings] - Integration settings for LLM judge
   * @param {string} [options.criteria] - Optional validation criteria from /validate children
   * @returns {Promise<void>} Resolves after winner is merged; rejects if all candidates fail
   */
  static async execute(commandExecutor, store, cellId, prompt, N, options = {}) {
    const {isTableCommand = false, generatorFamily, settings, criteria} = options

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
      const cellNode = store._nodes?.[cellId]
      if (cellNode) {
        const originalTitle = this.stripBestOfSuffix(cellNode.title || '')
        cellNode.title = `${originalTitle} [✗ 0/${N} passed]`
      }
      throw new Error('All candidates failed structural validation')
    }

    let winner

    if (candidates.length === 1) {
      winner = candidates[0]
    } else {
      const judgment = await LLMJudge.evaluate(prompt, candidates, generatorFamily, settings, {criteria})
      winner = candidates[judgment.winnerIndex]
    }

    StoreFork.applyCandidate(store, winner, cellId)
    const cellNode = store._nodes?.[cellId]
    if (cellNode) {
      const originalTitle = this.stripBestOfSuffix(cellNode.title || '')
      const passCount = candidates.length
      cellNode.title = `${originalTitle} [✓ ${passCount}/${N} best of ${N}]`
    }
  }
}

export default BestOfNStrategy

import LLMJudge from '../core/LLMJudge'

/**
 * @typedef {Object} CorpusEntry
 * @property {string} prompt
 * @property {Array<{getOutput: Function, _nodes: Object}>} candidates
 * @property {number} groundTruthBest
 */

/**
 * @typedef {Object} EvalReport
 * @property {number} accuracy
 * @property {number} missRate
 * @property {number} totalEntries
 * @property {number} correctPicks
 * @property {number} failedCalls
 * @property {Array<EvalEntryResult>} entries
 */

/**
 * @typedef {Object} EvalEntryResult
 * @property {number} index
 * @property {number} groundTruth
 * @property {number} judgeWinner
 * @property {number|null} confidence
 * @property {string|null} reason
 * @property {boolean} correct
 */

class EvalHarness {
  /**
   * @param {CorpusEntry[]} corpus
   * @param {string} generatorFamily
   * @param {Object} settings
   * @param {Object} [judgeOptions]
   * @returns {Promise<EvalReport>}
   */
  static async evaluate(corpus, generatorFamily, settings, judgeOptions = {}) {
    const entryResults = await Promise.allSettled(
      corpus.map((entry, index) => this.evaluateEntry(entry, index, generatorFamily, settings, judgeOptions)),
    )

    const entries = entryResults.filter(r => r.status === 'fulfilled').map(r => r.value)

    const correctPicks = entries.filter(e => e.correct).length
    const failedCalls = entries.filter(e => e.reason !== null).length

    return {
      accuracy: entries.length ? correctPicks / entries.length : 0,
      missRate: entries.length ? 1 - correctPicks / entries.length : 1,
      totalEntries: entries.length,
      correctPicks,
      failedCalls,
      entries,
    }
  }

  /** @private */
  static async evaluateEntry(entry, index, generatorFamily, settings, judgeOptions) {
    const {prompt, candidates, groundTruthBest} = entry

    const judgment = await LLMJudge.evaluate(prompt, candidates, generatorFamily, settings, judgeOptions)

    return {
      index,
      groundTruth: groundTruthBest,
      judgeWinner: judgment.winnerIndex,
      confidence: judgment.confidence,
      reason: judgment.reason,
      correct: judgment.reason === null && judgment.winnerIndex === groundTruthBest,
    }
  }
}

export default EvalHarness

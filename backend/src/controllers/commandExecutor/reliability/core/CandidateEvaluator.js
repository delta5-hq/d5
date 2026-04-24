/**
 * Structural validation for LLM command outputs
 * Provides zero-cost, zero-false-positive filtering (β≈0)
 */
class CandidateEvaluator {
  /**
   * @typedef {Object} ValidationResult
   * @property {boolean} pass
   * @property {string|null} reason
   */

  /**
   * @param {import('../../commands/utils/Store').default} store
   * @param {string} originalPrompt
   * @param {Object} options
   * @param {boolean} [options.isTableCommand]
   * @returns {ValidationResult}
   */
  static validate(store, originalPrompt, options = {}) {
    const output = store.getOutput()

    const emptyCheck = this.checkEmpty(output)
    if (!emptyCheck.pass) return emptyCheck

    const echoCheck = this.checkEcho(output, originalPrompt)
    if (!echoCheck.pass) return echoCheck

    if (options.isTableCommand) {
      const tableCheck = this.checkTableOutput(output)
      if (!tableCheck.pass) return tableCheck
    }

    return {pass: true, reason: null}
  }

  /**
   * @private
   */
  static checkEmpty(output) {
    if (output.nodes.length === 0 && output.edges.length === 0) {
      return {pass: false, reason: 'empty_output'}
    }
    return {pass: true, reason: null}
  }

  /**
   * @private
   */
  static checkEcho(output, originalPrompt) {
    if (!originalPrompt?.trim()) {
      return {pass: true, reason: null}
    }

    const outputText = output.nodes
      .map(n => n.title || '')
      .join(' ')
      .trim()

    const normalizedPrompt = originalPrompt.trim()

    if (outputText === normalizedPrompt) {
      return {pass: false, reason: 'echo_detected'}
    }

    return {pass: true, reason: null}
  }

  /**
   * @private
   */
  static checkTableOutput(output) {
    const hasGridOptions = output.nodes.some(n => n.gridOptions)

    if (!hasGridOptions) {
      return {pass: false, reason: 'no_grid_options'}
    }

    return {pass: true, reason: null}
  }
}

export default CandidateEvaluator

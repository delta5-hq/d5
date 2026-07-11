const LLM_COMMAND_ERROR_PREFIX = 'Error:'

class CandidateEvaluator {
  static validate(store, originalPrompt, options = {}) {
    const output = store.getOutput()

    const emptyCheck = this.checkEmpty(output)
    if (!emptyCheck.pass) return emptyCheck

    const echoCheck = this.checkEcho(output, originalPrompt)
    if (!echoCheck.pass) return echoCheck

    const errorCheck = this.checkErrorContent(output)
    if (!errorCheck.pass) return errorCheck

    if (options.isTableCommand) {
      const tableCheck = this.checkTableOutput(output)
      if (!tableCheck.pass) return tableCheck
    }

    return {pass: true, reason: null}
  }

  static isErrorText(text) {
    return typeof text === 'string' && text.trim().startsWith(LLM_COMMAND_ERROR_PREFIX)
  }

  /** @private */
  static checkEmpty(output) {
    if (output.nodes.length === 0 && output.edges.length === 0) {
      return {pass: false, reason: 'empty_output'}
    }
    return {pass: true, reason: null}
  }

  /** @private */
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

  // LLM commands emit caught errors as `Error: …` node titles — a candidate where all nodes carry this is a failed call.
  /** @private */
  static checkErrorContent(output) {
    const meaningfulNodes = output.nodes.filter(n => n.title?.trim())
    if (meaningfulNodes.length === 0) return {pass: true, reason: null}

    const allAreErrorOutput = meaningfulNodes.every(n => n.title.trim().startsWith(LLM_COMMAND_ERROR_PREFIX))

    return allAreErrorOutput ? {pass: false, reason: 'error_content'} : {pass: true, reason: null}
  }

  /** @private */
  static checkTableOutput(output) {
    const hasGridOptions = output.nodes.some(n => n.gridOptions)

    if (!hasGridOptions) {
      return {pass: false, reason: 'no_grid_options'}
    }

    return {pass: true, reason: null}
  }
}

export default CandidateEvaluator

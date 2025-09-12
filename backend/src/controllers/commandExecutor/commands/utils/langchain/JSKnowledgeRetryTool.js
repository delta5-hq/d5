import {
  getSearchScrapeDescription,
  getSearchScrapeName,
} from '../../../constants/localizedPrompts/SearchScrapeConstants'
import {JSKnowledgeMapResultTool} from './JSKnowledgeMapResultTool'
import {tolerantArrayParsing} from './../tolerantArrayParsing'
import {createTree} from './../createTree'

export class JSKnowledgeRetryTool {
  _result = ''

  constructor(tool, options) {
    this.tool = tool
    this.options = options
  }

  get result() {
    return this._result
  }

  asTool() {
    return new JSKnowledgeMapResultTool(this, {
      name: getSearchScrapeName(this.options.lang),
      description: getSearchScrapeDescription(this.options.lang),
      func: this.getDynamicToolResult.bind(this),
    })
  }

  async getDynamicToolResult(input, runManager) {
    const result = await this.getKnowledgeMap(input, runManager)
    this._result = result
    return result
  }

  async getKnowledgeMap(input, runManager) {
    const llmOutput = await this.tool.getLLMOutput(input)

    const converted = await this.convertWithRetry(llmOutput, runManager)

    return converted || 'Not valid response'
  }

  async getLLMOutput(input) {
    return this.tool.getLLMOutput(input)
  }

  async convertOutput(output, runManager) {
    return this.tool.convertOutput(output, runManager)
  }

  validateOutline(outline) {
    try {
      const arr = tolerantArrayParsing(outline)
      const textTree = createTree(arr)

      return !!textTree
    } catch (e) {
      return false
    }
  }

  async convertWithRetry(output, runManager) {
    let retryCount = this.options.retry || 3

    while (retryCount) {
      retryCount -= 1

      // eslint-disable-next-line no-await-in-loop
      const structuredOutput = await this.convertOutput(output, runManager)

      if (this.validateOutline(structuredOutput)) {
        return structuredOutput
      }
    }

    return undefined
  }
}

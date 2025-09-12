import {PromptTemplate, LLMChain} from 'langchain'
import {DocumentRetriever} from './DocumentRetriever'
import {JSKnowledgeMapResultTool} from './JSKnowledgeMapResultTool'
import {
  getSearchScrapeDescription,
  getSearchScrapeName,
} from '../../../constants/localizedPrompts/SearchScrapeConstants'
import {getJSKnowledgeMapConvertInstructions} from '../../../constants/localizedPrompts/JSKnowledgeMapConstants'

export class JSKnowledgeMapWebScholarSearch {
  constructor(model, vectorStore, options) {
    this._result = ''
    this.model = model
    this.vectorStore = vectorStore
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
    const result = await this.getKnowledgeMapWebExt(input, runManager)
    this._result = result
    return result
  }

  async getKnowledgeMapWebExt(input, runManager) {
    const {convertOutputToOutline = true} = this.options

    const scrapeOutput = await this.getLLMOutput(input)

    if (!convertOutputToOutline) {
      return scrapeOutput
    }

    return this.convertOutput(scrapeOutput, runManager)
  }

  async getLLMOutput(input) {
    const {
      baseUrl,
      maxChunks,
      disableSearchScrape,
      chunkSize,
      serpApiParams,
      citations,
      abortSignal,
      lang,
      userInput,
      onError,
    } = this.options

    const output = await new DocumentRetriever(this.vectorStore, {
      llm: this.model,
      serpBaseUrl: baseUrl,
      name: 'Search',
      maxChunks,
      onError,
      disableSearchScrape,
      isCitationsNeeded: Boolean(citations),
      chunkSize,
      serpApiParams,
      abortSignal,
      lang,
      userInput,
    }).callWithCitations(input)

    let scrapeOutput = ''

    if (typeof output !== 'string') {
      scrapeOutput = output.result
      if (citations) {
        citations.length = 0
        citations.push(...output.citations)
      }
    } else {
      scrapeOutput = output
    }

    return scrapeOutput
  }

  async convertOutput(output, runManager) {
    return new LLMChain({
      prompt: PromptTemplate.fromTemplate(getJSKnowledgeMapConvertInstructions(this.options.lang)),
      llm: this.model,
    }).run(output, runManager?.getChild())
  }
}

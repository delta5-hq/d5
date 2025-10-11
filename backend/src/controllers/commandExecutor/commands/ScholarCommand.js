import debug from 'debug'
import {clearCommandsWithParams} from '../constants'
import {clearStepsPrefix} from '../constants/steps'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import {readLangParam, readCitationParam} from '../constants'
import {getEmbeddings, determineLLMType, getIntegrationSettings, getLLM} from './utils/langchain/getLLM'
import {conditionallyTranslate} from './utils/translate'
import {createSimpleAgentExecutor} from './utils/langchain/getAgentExecutor'
import {JSKnowledgeMapWebScholarSearch} from './utils/langchain/JSKnowledgeMapWebScholarSearch'
import {WebVectorStore} from './utils/langchain/vectorStore/WebVectorStore'
import {readMaxChunksParam} from '../constants'
import {SERP_API_SCHOLAR_PARAMS, readScholarMinYearParam} from '../constants/outline'
import {CITATIONS_STRING, calculateMaxChunksFromSize} from '../constants'
import {referencePatterns} from './references/utils/referencePatterns'
import {clearReferences} from './references/utils/referenceUtils'
import {REF_DEF_PREFIX, HASHREF_DEF_PREFIX} from './references/referenceConstants'
// eslint-disable-next-line no-unused-vars
import Store from './utils/Store'

const log = debug('delta5:app:Command:Scholar')

/**
 * Class representing a Scholar Command.
 */
export class ScholarCommand {
  /**
   * Creates an instance of ScholarCommand
   * @param {string} userId - The unique identifier for the user
   * @param {string} workflowId - The unique identifier for the map (optional)
   * @param {Store} store - The store object
   */
  constructor(userId, workflowId, store) {
    this.store = store
    this.userId = userId
    this.workflowId = workflowId
    this.log = log.extend(userId, '/')
    if (this.workflowId) {
      this.log = this.log.extend(workflowId, '#')
    }
    this.logError = this.log.extend('ERROR*', '::')
  }
  async createResponseScholar(node, userInput, params) {
    try {
      const lang = params?.lang
      const serpApiParams = {...SERP_API_SCHOLAR_PARAMS, as_ylo: params?.minYear}

      const settings = await getIntegrationSettings(this.userId)
      const llmType = determineLLMType(node?.command, settings)
      const {llm, chunkSize} = getLLM({settings, type: llmType})
      const embeddings = getEmbeddings({settings, type: llmType})

      const vectorStore = new WebVectorStore({
        ...embeddings,
        logError: this.logError,
      })

      const citations = []
      const searchTool = new JSKnowledgeMapWebScholarSearch(llm, vectorStore, {
        maxChunks: params?.maxChunks,
        disableSearchScrape: false,
        chunkSize,
        serpApiParams,
        citations: params?.citations ? citations : undefined,
        userInput,
        onError: this.logError,
        convertOutputToOutline: false,
      }).asTool()

      const tools = [searchTool]

      const executor = createSimpleAgentExecutor(llm, tools, lang)

      let result = (await executor.call({input: userInput})).output

      result = await conditionallyTranslate(result, lang, llm, this.logError, settings)

      if (params?.citations) {
        result += `\n\n${CITATIONS_STRING}:\n    ${citations.join('\n    ')}`
      }

      return result
    } catch (e) {
      this.logError(e)
      return ''
    }
  }

  getParams = title => {
    const lang = readLangParam(title)
    const citations = readCitationParam(title)

    const size = readMaxChunksParam(title)
    const maxChunks = calculateMaxChunksFromSize(size)
    const minYear = readScholarMinYearParam(title)

    return {
      lang,
      citations,
      maxChunks,
      minYear,
    }
  }

  async run(node, originalPrompt) {
    let prompt = originalPrompt
    const title = node?.command || node?.title

    if (!prompt || referencePatterns.withAssignmentPrefix().test(title)) {
      prompt = substituteReferencesAndHashrefsChildrenAndSelf(this.store.getNode(node.id), this.store)
    } else {
      prompt = clearCommandsWithParams(
        clearReferences(clearReferences(clearStepsPrefix(prompt), REF_DEF_PREFIX), HASHREF_DEF_PREFIX),
      )
    }

    const params = this.getParams(title)
    const text = await this.createResponseScholar(node, prompt, params)

    this.store.importer.createNodes(text, node.id)
  }
}

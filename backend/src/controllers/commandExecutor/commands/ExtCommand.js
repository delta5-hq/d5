import debug from 'debug'
import {
  calculateMaxChunksFromSize,
  clearCommandsWithParams,
  clearReferences,
  HASHREF_DEF_PREFIX,
  readCitationParam,
  readLangParam,
  readMaxChunksParam,
  REF_DEF_PREFIX,
} from '../constants'
import {determineLLMType, getEmbeddings, getIntegrationSettings, getLLM} from './utils/langchain/getLLM'
import {ExtVectorStore} from './utils/langchain/vectorStore/ExtVectorStore'
import {JSKnowledgeMapWebScholarSearch} from './utils/langchain/JSKnowledgeMapWebScholarSearch'
import {createSimpleAgentExecutor} from './utils/langchain/getAgentExecutor'
import {readExtContextParam} from '../constants/ext'
import {translate} from './utils/translate'
import {referencePatterns} from './references/utils/referencePatterns'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import {clearStepsPrefix} from '../constants/steps'
// eslint-disable-next-line no-unused-vars
import Store from './utils/Store'

const log = debug('delta5:app:Command:Ext')

/**
 * Class representing a Ext Command.
 */
export class ExtCommand {
  /**
   * Creates an instance of ExtCommand
   * @param {string} userId - The unique identifier for the user
   * @param {string} workflowId - The unique identifier for the map (optional)
   * @param {Store} store - The store object
   */
  constructor(userId, workflowId, store) {
    this.userId = userId
    this.workflowId = workflowId
    this.store = store
    this.log = log.extend(userId, '/')
    if (this.workflowId) {
      this.log = this.log.extend(workflowId, '#')
    }
    this.logError = this.log.extend('ERROR*', '::')
  }

  async translate(text, llm, outputLang) {
    const response = await translate(text, outputLang, llm, this.logError)

    return response
  }

  async createResponseExt(node, userInput, params) {
    try {
      const lang = params?.lang
      const settings = await getIntegrationSettings(this.userId)
      const llmType = determineLLMType(node?.command, settings)
      const {llm, chunkSize} = getLLM({settings, type: llmType, log: this.log})
      const {storageType, ...extStoreData} = getEmbeddings({settings, type: llmType})
      const vectorStore = new ExtVectorStore({
        ...extStoreData,
        log: this.log,
        userId: this.userId,
        contextName: params?.context,
        storageType,
      })

      await vectorStore.setVectors()

      const citations = []

      const searchTool = new JSKnowledgeMapWebScholarSearch(llm, vectorStore, {
        maxChunks: params?.maxChunks,
        disableSearchScrape: true,
        chunkSize,
        citations: params?.citations ? citations : undefined,
        userInput,
        onError: this.logError,
        convertOutputToOutline: false,
      }).asTool()

      const tools = [searchTool]

      const executor = createSimpleAgentExecutor(llm, tools, lang)

      let result = (await executor.call({input: userInput})).output

      if (lang && result) {
        result = await this.translate(result, llm, lang)
      }

      if (params?.citations) {
        result += `\n\nCitations:\n    ${citations.join('\n    ')}`
      }

      return result
    } catch (e) {
      this.logError(e)
      return ''
    }
  }

  getParams = title => {
    const lang = readLangParam(title)
    const context = readExtContextParam(title)
    const citations = readCitationParam(title)

    const size = readMaxChunksParam(title)
    const maxChunks = calculateMaxChunksFromSize(size)

    return {
      lang,
      maxChunks,
      context,
      citations,
    }
  }

  async run(node, originalPrompt) {
    let prompt = originalPrompt
    const command = node?.command || node?.title

    if (!prompt || referencePatterns.withAssignmentPrefix().test(command)) {
      prompt = substituteReferencesAndHashrefsChildrenAndSelf(this.store.getNode(node.id), this.store)
    } else {
      prompt = clearCommandsWithParams(
        clearReferences(clearReferences(clearStepsPrefix(prompt), REF_DEF_PREFIX), HASHREF_DEF_PREFIX),
      )
    }

    const params = this.getParams(command)
    const text = await this.createResponseExt(node, prompt, params)

    this.store.importer.createNodes(text, node.id)
  }
}

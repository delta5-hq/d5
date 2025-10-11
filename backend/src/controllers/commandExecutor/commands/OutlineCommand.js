import debug from 'debug'
import {CITATIONS_STRING, calculateMaxChunksFromSize, readCitationParam, readLangParam} from '../constants'
import {clearStepsPrefix} from '../constants/steps'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import {getEmbeddings, getIntegrationSettings, determineLLMType, getLLM} from './utils/langchain/getLLM'
import {createOutlineAgentExecutor} from './utils/langchain/getAgentExecutor'
import {JSKnowledgeMapWebScholarSearch} from './utils/langchain/JSKnowledgeMapWebScholarSearch'
import {JSKnowledgeMapSearch} from './utils/langchain/JSKnowledgeMapSearch'
import {
  DEBUG_LEVEL,
  LEVELS,
  SERP_API_SCHOLAR_PARAMS,
  readDebugLevelParam,
  readExtParam,
  readHrefParam,
  readLevelsParam,
  readScholarMinYearParam,
  readScholarParam,
  readSummarizeParam,
  readWebParam,
} from '../constants/outline'
import {tolerantArrayParsing} from './utils/tolerantArrayParsing'
import {createTree} from './utils/createTree'
import {conditionallyTranslate} from './utils/translate'
import {UNKNOWN_STRING} from '../constants/localizedPrompts/JSOutliningAgentContants'
import {createContextForMap, includesAny} from './utils/createContextForMap'
import {WebVectorStore} from './utils/langchain/vectorStore/WebVectorStore'
import {SummarizeCommand} from './SummarizeCommand'
import {JSKnowledgeRetryTool} from './utils/langchain/JSKnowledgeRetryTool'
import {isOutlineSummarize} from './utils/isCommand'
import {readEmbedParam} from '../constants/summarize'
import {referencePatterns} from './references/utils/referencePatterns'
import {clearReferences} from './references/utils/referenceUtils' // Direct import
import {REF_DEF_PREFIX, HASHREF_DEF_PREFIX} from './references/referenceConstants'
import {clearCommandsWithParams} from '../constants'
import {ExtVectorStore} from './utils/langchain/vectorStore/ExtVectorStore'
import {readExtContextParam} from '../constants/ext'
// eslint-disable-next-line no-unused-vars
import Store from './utils/Store'

const log = debug('delta5:app:Command:Outline')

const exclusionStrings = [UNKNOWN_STRING, CITATIONS_STRING]

/**
 * Class representing a Outline Command.
 */
export class OutlineCommand {
  /**
   * Creates an instance of OutlineCommand
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

  getTree = (llmOutput, citations, params) => {
    try {
      const arr = tolerantArrayParsing(llmOutput)

      let textTree = createTree(arr)
      if (params?.citations) {
        const uniqueCitations = Array.from(new Set(citations))
        textTree += `\n\nCitations:\n    ${uniqueCitations.join('\n    ')}`
      }

      return textTree
    } catch (e) {
      this.logError(e)
      return undefined
    }
  }

  getTreeInOutputLang = async (llmOutput, citations, llm, params, settings) => {
    const translated = await conditionallyTranslate(llmOutput, params?.lang, llm, this.logError, settings)
    const translatedTree = this.getTree(translated, citations, params)

    return translatedTree || this.getTree(llmOutput, citations, params)
  }

  async createResponseOutline(node, userInput, params) {
    const formatOutputAsTree = async (llmOutput, citations, llm, params, settings) => {
      try {
        return this.getTreeInOutputLang(llmOutput, citations, llm, params, settings)
      } catch (e) {
        this.logError(e)
        return llmOutput
      }
    }

    const runAgent = async (model, searchTool, query, outputLang) => {
      const executor = createOutlineAgentExecutor(model, [searchTool], outputLang)
      try {
        return await executor.run(query)
      } catch (e) {
        this.logError(e)
        return searchTool.result
      }
    }

    const lang = params?.lang
    const settings = await getIntegrationSettings(this.userId)
    const llmType = determineLLMType(node?.command, settings)
    const {llm, chunkSize} = getLLM({type: llmType, settings})
    const embeddings = getEmbeddings({type: llmType, settings})

    const citations = []
    let searchTool = {}

    if (params.maxChunks || params.disableSearchScrape) {
      const maxChunks = params.maxChunks
      const disableSearchScrape = params.disableSearchScrape
      const serpApiParams = params.serpApiParams
      const hrefs = params.from

      let vectorStore

      if (disableSearchScrape) {
        vectorStore = new ExtVectorStore({
          ...embeddings,
          contextName: params?.context,
          userId: this.userId,
          log: this.log,
        })

        await vectorStore.setVectors()
      } else {
        vectorStore = new WebVectorStore({
          ...embeddings,
          logError: this.logError,
        })
      }

      searchTool = new JSKnowledgeRetryTool(
        new JSKnowledgeMapWebScholarSearch(llm, vectorStore, {
          maxChunks,
          params,
          disableSearchScrape,
          chunkSize,
          serpApiParams,
          hrefs,
          citations: params?.citations ? citations : undefined,
          lang,
          userInput,
          onError: this.logError,
        }),
        {lang},
      ).asTool()
    } else {
      searchTool = new JSKnowledgeRetryTool(new JSKnowledgeMapSearch(llm, {lang}), {lang}).asTool()
    }

    try {
      const llmOutput = await runAgent(llm, searchTool, userInput, lang)
      return formatOutputAsTree(llmOutput, citations, llm, params, settings)
    } catch (e) {
      this.logError(e)
      return ''
    }
  }

  getParams = title => {
    const minYear = readScholarMinYearParam(title)
    if (minYear && minYear > new Date().getFullYear()) {
      throw Error("min_year can't be later than the current year")
    }

    const lang = readLangParam(title)
    const citations = readCitationParam(title)

    const href = readHrefParam(title)
    const from = href ? [href] : []

    const web = readWebParam(title)
    const scholar = readScholarParam(title)
    const maxChunks = scholar ? calculateMaxChunksFromSize(scholar) : web ? calculateMaxChunksFromSize(web) : undefined
    const serpApiParams = scholar ? {...SERP_API_SCHOLAR_PARAMS, as_ylo: minYear} : undefined

    const ext = readExtParam(title)
    const disableSearchScrape = !!ext
    const context = readExtContextParam(title)

    return {citations, from, maxChunks, serpApiParams, lang, disableSearchScrape, context}
  }

  replyDefault = async (node, prompt, params) => {
    const text = await this.createResponseOutline(node, prompt, params)

    this.store.importer.createNodes(text, node.id)
  }

  replySecondDebugLevelOutline = async (node, params) => {
    const mapContexts = createContextForMap(node, this.store._nodes, childNode =>
      includesAny(exclusionStrings, childNode?.title),
    )

    await Promise.all(mapContexts.map(({context, node: lastNode}) => this.replyDefault(lastNode, context, params)))
  }

  replySecondLevelsOutline = async (node, prompt, params) => {
    await this.replyDefault(node, prompt, params)

    await this.replySecondDebugLevelOutline(node, params)
  }

  // eslint-disable-next-line no-unused-vars
  replyThirdLevelsOutline = async (node, prompt, params) => {
    // TODO
  }

  async replyWithSummarize(node, command, prompt, params) {
    const summarizeExecutor = new SummarizeCommand(this.userId, this.workflowId, this.store)

    const answer = await summarizeExecutor.replyDefault(node, command, prompt, {
      ...params,
      sizeLabel: readEmbedParam(prompt) || readSummarizeParam(prompt),
      structured: true,
    })

    const tree = this.getTree(answer, [])
    this.store.importer.createNodes(tree || answer, node.id)
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

    const debuglevel = readDebugLevelParam(title)
    const levels = readLevelsParam(title)

    const params = this.getParams(title)

    if (isOutlineSummarize(title)) {
      await this.replyWithSummarize(node, title, prompt, params)
    } else if (debuglevel === DEBUG_LEVEL.Second) {
      await this.replySecondDebugLevelOutline(node, params)
    } else if (levels >= LEVELS.Second) {
      await this.replySecondLevelsOutline(node, prompt, params)
    } else {
      await this.replyDefault(node, prompt, params)
    }
  }
}

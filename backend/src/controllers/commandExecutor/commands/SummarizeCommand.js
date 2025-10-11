import debug from 'debug'
import {CHUNK_SIZE, CHUNK_SIZE_REGEX, readLangParam, readMaxChunksParam} from '../constants'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import {
  readEmbedParam,
  readSummarizeParentParam,
  SUMMARIZE_PARAM_EMBED_REGEX,
  SUMMARIZE_QUERY,
} from '../constants/summarize'
import {conditionallyTranslate} from './utils/translate'
import {FOREACH_QUERY} from '../constants/foreach'
import {PromptTemplate} from 'langchain'
import {RefineDocumentsChain} from 'langchain/chains'
import {ConditionalPromptSelector} from 'langchain/prompts'
import {RecursiveCharacterTextSplitter} from 'langchain/text_splitter'
import {AgentExecutor} from 'langchain/agents'
import {LLMChain} from 'langchain'
import {JSKnowledgeMapWebScholarSearch} from './utils/langchain/JSKnowledgeMapWebScholarSearch'
import {WebVectorStore} from './utils/langchain/vectorStore/WebVectorStore'
import {getEmbeddings, getIntegrationSettings, determineLLMType, getLLM} from './utils/langchain/getLLM'
import {JSOutliningAgent} from './utils/langchain/JSOutliningAgent'
import {
  getSimpleFinalAnswerAction,
  getSimpleInputRegex,
  getSimpleLLMPrefix,
  getSimplePrefix,
  getSimpleStop,
  getSimpleSuffix,
} from '../constants/localizedPrompts/SimpleAgentConstants'
import {
  QUESTION_PROMPT_TEMPLATE_EN,
  REFINE_PROMPT_TEMPLATE_EN,
} from '../constants/localizedPrompts/SearchScrapeConstants'
import {Lang} from '../constants/localizedPrompts'
import {getJSKnowledgeMapConvertInstructions} from '../constants/localizedPrompts/JSKnowledgeMapConstants'
import {SUMMARIZE_SIZE_DEFAULT} from '../constants/outline'
import {referencePatterns} from './references/utils/referencePatterns'
import {REF_DEF_PREFIX, HASHREF_DEF_PREFIX} from './references/referenceConstants'
import {clearReferences} from './references/utils/referenceUtils'
import {clearCommandsWithParams} from '../constants'
import {clearStepsPrefix} from '../constants/steps'
import {NodeTextExtractor} from './utils/NodeTextExtractor'
// eslint-disable-next-line no-unused-vars
import Store from './utils/Store'

const log = debug('delta5:app:Command:Summarize')

const FORMAT_INSTRUCTIONS = `Use the following format in your response:

Question: the original question
Thought: you must always think which action to take or give the final answer
Action: action to take, available actions are [{tool_names}]. Do not translate the name of the action or add your comments to the name
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: Based on observations, not prior knowledge, I will give the final answer
Final Answer: the final answer to the original question.`

export function sanitizeRefineOutput(str) {
  return str
    .replace(/```/g, ' ')
    .replace(/Question:/gi, ' ')
    .replace(/Original answer:/gi, ' ')
    .replace(/New (context|answer):/gi, ' ')
    .replace(/(Refined )?answer:/gi, ' ')
}

export class SearchRefineLLMChain extends LLMChain {
  _getFinalOutput(generations, promptValue, runManager) {
    const output = generations[0]?.text
    if (output) {
      generations[0].text = sanitizeRefineOutput(output)
    }

    return super._getFinalOutput(generations, promptValue, runManager)
  }
}

/**
 * Class representing a Summarize Command.
 */
export class SummarizeCommand {
  /**
   * Creates an instance of SummarizeCommand
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

  async getText(node, maxSize, sumRootNode) {
    const validateFn = n => {
      return Boolean(
        n.title?.startsWith(FOREACH_QUERY) || (sumRootNode.id === n.id && n.title?.startsWith(SUMMARIZE_QUERY)),
      )
    }
    const extractor = new NodeTextExtractor(maxSize, validateFn, this.store)
    return extractor.extractFullContent(node)
  }

  async getDocuments(chunkSize, text) {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
    })

    const docs = await splitter.createDocuments([text])

    return docs
  }

  async runRefinementQAChain(question, input_documents, llm, params) {
    const {signal, templates} = params || {}
    const {
      question: questionTemplate = QUESTION_PROMPT_TEMPLATE_EN,
      refine: refineTemplate = REFINE_PROMPT_TEMPLATE_EN,
    } = templates || {}

    const refinePropmtTemplate = new PromptTemplate({
      inputVariables: ['question', 'existing_answer', 'context'],
      template: refineTemplate,
    })
    const questionPromptTemplate = new PromptTemplate({
      inputVariables: ['context', 'question'],
      template: questionTemplate,
    })

    const chain = new RefineDocumentsChain({
      llmChain: new SearchRefineLLMChain({
        prompt: new ConditionalPromptSelector(questionPromptTemplate).getPrompt(llm),
        llm,
      }),
      refineLLMChain: new SearchRefineLLMChain({
        prompt: new ConditionalPromptSelector(refinePropmtTemplate).getPrompt(llm),
        llm,
      }),
    })
    const res = await chain.call({
      input_documents,
      question,
      signal,
    })

    return res.output_text
  }

  async runAgentExecutor(model, sourceText, userInput, params, settings) {
    const {maxChunks, chunkSize, llmType} = params

    const embeddings = getEmbeddings({type: llmType, settings})

    const vectorStore = new WebVectorStore({
      ...embeddings,
      logError: this.logError,
    })

    await vectorStore.load([{content: sourceText, hrefs: []}])

    const searchTool = new JSKnowledgeMapWebScholarSearch(model, vectorStore, {
      maxChunks,
      disableSearchScrape: true,
      chunkSize,
      userInput,
      convertOutputToOutline: false,
      onError: this.logError,
    }).asTool()

    const tools = [searchTool]

    const executor = AgentExecutor.fromAgentAndTools({
      tags: [],
      agent: JSOutliningAgent.fromLLMAndTools(model, tools, {
        formatInstructions: FORMAT_INSTRUCTIONS,
        prefix: getSimplePrefix(),
        suffix: getSimpleSuffix(),
        finishToolName: getSimpleFinalAnswerAction(),
        inputRegex: getSimpleInputRegex(),
        llmPrefixStr: getSimpleLLMPrefix(),
        stopStr: getSimpleStop(),
      }),
      tools,
    })

    const answer = await executor.run(userInput)

    return answer
  }

  calculateMaxChunksFromSize(str) {
    switch (str.toLowerCase()) {
      case CHUNK_SIZE.xxl:
        return Infinity
      case CHUNK_SIZE.xl:
        return 250
      case CHUNK_SIZE.l:
        return 100
      case CHUNK_SIZE.m:
        return 75
      case CHUNK_SIZE.s:
        return 50
      case CHUNK_SIZE.xs:
        return 25
      case CHUNK_SIZE.xxs:
        return 10
      default:
        return 25
    }
  }

  calculateTextSize(str) {
    switch (str.toLowerCase()) {
      case CHUNK_SIZE.xxl:
        return Infinity
      case CHUNK_SIZE.xl:
        return 500_000
      case CHUNK_SIZE.l:
        return 100_000
      case CHUNK_SIZE.m:
        return 50_000
      case CHUNK_SIZE.s:
        return 15_000
      case CHUNK_SIZE.xs:
        return 5000
      case CHUNK_SIZE.xxs:
        return 500
      default:
        return 5000
    }
  }

  getStartNode(node, title) {
    let startNode = this.store.getNode(node.parent)

    const parentParam = readSummarizeParentParam(title)

    let loopIteration = 0
    while (this.store.getNode(startNode.parent) && loopIteration < parentParam) {
      startNode = this.store.getNode(startNode.parent)
      loopIteration += 1
    }

    return startNode
  }

  async translate(text, llm, outputLang, settings) {
    return conditionallyTranslate(text, outputLang, llm, this.logError, settings)
  }

  verifyMaxChunks(str) {
    return str.match(new RegExp(CHUNK_SIZE_REGEX))
  }

  verifyEmbedChunks(str) {
    return str.match(new RegExp(SUMMARIZE_PARAM_EMBED_REGEX))
  }

  async replyDefault(node, command, prompt, params) {
    const {lang = Lang.en, sizeLabel = SUMMARIZE_SIZE_DEFAULT, structured = false} = params ?? {}

    const settings = await getIntegrationSettings(this.userId)
    const llmType = determineLLMType(command, settings)
    const {llm, chunkSize} = getLLM({settings, type: llmType})

    const maxChunks = this.verifyMaxChunks(command) ? this.calculateMaxChunksFromSize(sizeLabel) : Infinity
    const textSize = this.verifyMaxChunks(command) ? this.calculateTextSize(sizeLabel) : Infinity

    const startNode = this.getStartNode(node, command)

    const text = await this.getText(startNode, textSize, node)

    if (!text.trim()) {
      throw Error('Nothing to summarize')
    }

    let answer = ''

    if (!this.verifyEmbedChunks(command)) {
      const docs = await this.getDocuments(chunkSize, text)
      answer = await this.runRefinementQAChain(prompt, docs.slice(0, maxChunks), llm)
    } else {
      answer = await this.runAgentExecutor(llm, text, prompt, {chunkSize, maxChunks, lang, llmType}, settings)
    }

    if (structured) {
      answer = await new LLMChain({
        prompt: PromptTemplate.fromTemplate(getJSKnowledgeMapConvertInstructions(lang)),
        llm,
      }).run(answer)
    }

    answer = await this.translate(answer, llm, lang, settings)

    return answer
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

    const answer = await this.replyDefault(node, command, prompt, {
      lang: readLangParam(command),
      sizeLabel: readEmbedParam(command) || readMaxChunksParam(command),
    })

    this.store.importer.createNodes(answer, node.id)
  }
}

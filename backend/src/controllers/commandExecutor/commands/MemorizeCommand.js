import debug from 'debug'
import {determineLLMType, getIntegrationSettings, getEmbeddings} from './utils/langchain/getLLM'
import {ExtVectorStore} from './utils/langchain/vectorStore/ExtVectorStore'
import {MEMORIZE_PARAM_KEEP_REGEX, MEMORIZE_QUERY_TYPE, readRechunkParam, readSplitParam} from '../constants/memorize'
import {FOREACH_QUERY_TYPE} from '../constants/foreach'
import {DEFAULT_CONTEXT_NAME, readExtContextParam} from '../constants/ext'
import {readMaxChunksParam} from '../constants'
import {NodeTextExtractor} from './utils/NodeTextExtractor'
// eslint-disable-next-line no-unused-vars
import Store from './utils/Store'

const log = debug('app:Command:Memorize')

/**
 * Class representing a Memorize Command.
 */
export class MemorizeCommand {
  /**
   * Creates an instance of MemorizeCommand
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

  isSpecialNode(node) {
    const {title = ''} = node
    return title.startsWith(FOREACH_QUERY_TYPE) || title.startsWith(MEMORIZE_QUERY_TYPE)
  }

  async getText(node, maxSize, separator) {
    const extractor = new NodeTextExtractor(maxSize, this.isSpecialNode.bind(this), this.store, separator)
    return extractor.extractFullContent(node)
  }

  calculateTextSize(str) {
    switch (str?.toLowerCase()) {
      case 'xxl':
        return Infinity
      case 'xl':
        return 500_000
      case 'l':
        return 100_000
      case 'm':
        return 50_000
      case 's':
        return 15_000
      case 'xs':
        return 5000
      case 'xxs':
        return 500
      default:
        return 5000
    }
  }

  getParams(command) {
    const context = readExtContextParam(command)
    const rechunk = readRechunkParam(command)
    const maxChunks = readMaxChunksParam(command)
    const split = readSplitParam(command)

    let keep = false
    const keepMatch = command.match(new RegExp(MEMORIZE_PARAM_KEEP_REGEX))

    if (keepMatch) {
      keep = keepMatch[2] === 'true'
    } else if (context === DEFAULT_CONTEXT_NAME) {
      keep = true
    }

    return {
      context,
      rechunk,
      maxChunks,
      keep,
      split,
    }
  }

  /**
   *
   * @param {string} content
   * @param {string} source
   * @param {string} [sep]
   * @returns {{content: string, hrefs: string[]}}
   */
  createChunks(content, source, sep) {
    if (!sep) return [{content, hrefs: [source]}]

    return content
      .split(sep)
      .filter(t => t.trim())
      .map(t => ({content: t.trim(), hrefs: [source]}))
  }

  async processChunks(node, rechunk, params) {
    const chunks = []
    const textSize = this.calculateTextSize(params?.maxChunks)

    if (rechunk) {
      const text = await this.getText(node, textSize, params?.split)
      if (text?.trim().length) {
        chunks.push(...this.createChunks(text, node.id, params?.split))
      }
    } else {
      const extractor = new NodeTextExtractor(textSize, this.isSpecialNode.bind(this), this.store, params?.split)
      const startNodeContent = await extractor.extractNodeOnlyContent(node)
      if (startNodeContent.trim().length) {
        chunks.push(...this.createChunks(startNodeContent, node.id, params?.split))
      }

      const nodesToProcess = [...(node.children ?? [])].map(n => this.store.getNode(n)).filter(Boolean)
      await Promise.all(
        nodesToProcess.map(async childNode => {
          if (childNode.id === node.id) {
            return
          }

          const content = await extractor.extractFullContent(childNode)
          if (content?.trim().length) {
            chunks.push(...this.createChunks(content, childNode.id, params?.split))
          }
        }),
      )
    }

    return chunks
  }

  async saveEmbeddings(vectorStore, chunks, keep) {
    if (!chunks.length) {
      throw new Error('No data that can be loaded to embeddings')
    }

    await vectorStore.load(chunks, keep)
  }

  async _getVectorStore(command, context) {
    const settings = await getIntegrationSettings(this.userId)
    const llmType = determineLLMType(command, settings)
    const {storageType, ...embeddings} = getEmbeddings({type: llmType, settings})
    return new ExtVectorStore({
      ...embeddings,
      userId: this.userId,
      contextName: context,
      log: this.log,
      storageType,
    })
  }

  async run(node) {
    try {
      const {context, rechunk, keep, split} = this.getParams(node.command)
      const vectorStore = await this._getVectorStore(node.command, context)

      const startNode = this.store.getNode(node.parent)
      if (!startNode) return

      const chunks = await this.processChunks(startNode, rechunk, {split})
      await this.saveEmbeddings(vectorStore, chunks, keep)
    } catch (e) {
      this.logError(e)
    }
  }
}

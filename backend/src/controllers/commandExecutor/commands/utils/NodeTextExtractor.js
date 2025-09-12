import {PhraseBuilder} from './../PhraseBuilder'
import {commandRegExp} from '../../constants/commandRegExp'
import {clearStepsPrefix} from '../../constants/steps'
import {CONTENT_TYPES_APPLICATION_PDF, extractTextFromPdf} from '../../../utils/pdf'
import WorkflowFile from '../../../../models/WorkflowFile'
import {substituteReferencesAndHashrefsSelf} from '../references/substitution'

// eslint-disable-next-line no-unused-vars
import Store from './Store'

export class NodeTextExtractor {
  placeholder = '␞'
  /**
   * @param {number} maxSize
   * @param {(node: {title?: string}) => boolean} validateNode
   * @param {Store} store - The store object
   * @param {string} [separator]
   */
  constructor(maxSize, validateNode, store, separator) {
    this.maxSize = maxSize
    this.validateNode = validateNode
    this.store = store
    this.separator = separator
  }

  /**
   *
   * @param {string} text
   * @returns
   */
  encodeSeparators(text) {
    return !this.separator ? text : text.replaceAll(this.separator, this.placeholder)
  }

  /**
   *
   * @param {string} text
   * @returns
   */
  decodeSeparators(text) {
    return !this.separator ? text : text.replaceAll(this.placeholder, this.separator)
  }

  /**
   * @param {{title?: string, file?: string}} node
   * @param {PhraseBuilder} builder
   * @returns {Promise<boolean>}
   */
  async extractNodeContent(node, builder) {
    if (this.validateNode(node)) {
      return false
    }

    if (builder.isFull()) {
      return false
    }

    if (node.title && !commandRegExp.any.test(clearStepsPrefix(node.title))) {
      const nodesContent = substituteReferencesAndHashrefsSelf(node, this.store)
      const isFull = builder.appendChunks(this.encodeSeparators(nodesContent))
      if (isFull) return false
    }

    if (node.file) {
      const fileId = node.file
      let fileText

      if (this.store.getFile(fileId)) {
        fileText = this.store.getFile(fileId)
      } else {
        const fileData = await WorkflowFile.findOne({_id: fileId})

        if (fileData && CONTENT_TYPES_APPLICATION_PDF.some(type => fileData.metadata?.contentType?.includes(type))) {
          const fileStream = fileData.read()
          const chunks = []

          for await (const chunk of fileStream) {
            chunks.push(chunk)
          }
          const fileBuffer = Buffer.concat(chunks)
          fileText = await extractTextFromPdf(fileBuffer, {from: 0}, {})
        }
      }

      if (fileText) {
        const isFull = builder.appendChunks(this.encodeSeparators(fileText))
        if (isFull) return false
      }
    }

    return true
  }

  /**
   * @param {{id: string}} node
   * @returns {Promise<string>}
   */
  async extractFullContent(node) {
    const builder = new PhraseBuilder(this.maxSize)

    const traverseNode = async currentNodeId => {
      const currentNode = this.store.getNode(currentNodeId)
      if (!currentNode) {
        return
      }

      const canContinue = await this.extractNodeContent(currentNode, builder)

      if (canContinue && currentNode?.children?.length) {
        for (const childId of currentNode.children) {
          await traverseNode(childId)
        }
      }
    }

    await traverseNode(node.id)
    return this.decodeSeparators(builder.result())
  }

  /**
   * @param {{title?: string, file?: string}} node
   * @returns {Promise<string>}
   */
  async extractNodeOnlyContent(node) {
    const builder = new PhraseBuilder(this.maxSize)
    await this.extractNodeContent(node, builder)
    return this.decodeSeparators(builder.result())
  }
}

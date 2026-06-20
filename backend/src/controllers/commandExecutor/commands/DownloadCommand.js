import debug from 'debug'
import {scrapeFiles} from '../../utils/scrape'
import {readMaxPagesParam, readMaxSizeParam} from '../constants/download'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import {clearCommandsWithParams} from '../constants'
import {clearStepsPrefix} from '../constants/steps'
import WorkflowFile from '../../../models/WorkflowFile'
import {Readable} from 'stream'
import {referencePatterns} from './references/utils/referencePatterns'
import {clearReferences} from './references/utils/referenceUtils'
import {REF_DEF_PREFIX, HASHREF_DEF_PREFIX} from './references/referenceConstants'
import {runWithErrorNode} from './shared/runWithErrorNode'
// eslint-disable-next-line no-unused-vars
import Store from './utils/Store'

const log = debug('app:Command:Download')

const formatDownloadConfirmation = files => {
  const names = files.map(file => file.title).filter(Boolean)
  if (!names.length) return 'Downloaded content is already attached to this node'
  return `Downloaded content already attached: ${names.join(', ')}`
}

/**
 * Class representing a Download Command.
 */
export class DownloadCommand {
  /**
   * Creates an instance of DownloadCommand
   * @param {string} userId - The unique identifier for the user
   * @param {string} workflowId - The unique identifier for the workflow (optional)
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

  extractUniqueUrls(input) {
    const parsedUrls = input.match(/\bhttps?:\/\/[^\s)]+/g) || []

    const urls = new Set(
      parsedUrls
        .map(url => url.replace(/[.,!?;:]+$/, ''))
        .map(url => {
          try {
            const normalizedUrl = new URL(url)
            return normalizedUrl.href.replace(/\/$/, '')
          } catch {
            return null
          }
        })
        .filter(url => !!url),
    )

    return Array.from(urls)
  }

  async scrape(urls, params) {
    return scrapeFiles(urls, params)
  }

  upload(file) {
    const readStream = Readable.from(file.content)
    return WorkflowFile.write(
      {
        filename: file.filename,
        metadata: {
          workflowId: this.workflowId,
          contentType: file.contentType,
          userId: this.userId,
        },
      },
      readStream,
    )
  }

  async saveFile(node, data) {
    const {content, filename} = data

    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8')

    const file = {
      filename,
      contentType: 'text/plain',
      content: buffer,
    }

    const result = await this.upload(file)

    const fileId = result._id.toString()
    this.store.createNode({
      file: fileId,
      title: filename,
      parent: node.id,
    })
    this.store.createFile(fileId, content)

    return undefined
  }

  /* eslint-disable */
  hash(str, chunkSize = 64 * 1024) {
    const encoder = new TextEncoder()
    const data = encoder.encode(str)
  
    let startChunk = new Uint8Array(0)
    let endChunk = new Uint8Array(chunkSize)
    let totalLength = 0
    let endOffset = 0
  
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize)
      totalLength += chunk.length
  
      // Filling the initial chunk
      if (startChunk.length < chunkSize) {
        const remaining = chunkSize - startChunk.length
        startChunk = new Uint8Array([...startChunk, ...chunk.slice(0, remaining)])
      }
  
      // Filling the ring buffer for the last chunk
      if (totalLength >= chunkSize) {
        const availableSpace = chunkSize - endOffset
        if (chunk.length <= availableSpace) {
          // If the current chunk fits into the free space of the ring buffer
          endChunk.set(chunk, endOffset)
          endOffset += chunk.length
        } else {
          // If the current chunk exceeds the available space, shift the contents
          endChunk.set(chunk.slice(chunk.length - chunkSize), 0)
          endOffset = chunkSize
        }
      }
    }

    const combined = new Uint8Array(startChunk.length + endChunk.length)
    combined.set(startChunk)
    combined.set(endChunk, startChunk.length)
    
    let hash = 0x811c9dc5
  
    for (let i = 0; i < combined.length; i++) {
      hash ^= combined[i]
      hash = (hash * 0x01000193) >>> 0
    }
  
    return (hash >>> 0).toString(16)
  }
  /* eslint-enable */

  getNodeFiles(node) {
    return Object.values(this.store._nodes)
      .filter(n => n.parent === node.id)
      .reduce((acc, n) => {
        if (n.file) acc[n.file] = n.title
        return acc
      }, {})
  }

  async insertFileToWorkflow(node, input, params) {
    const urls = this.extractUniqueUrls(input)

    if (!urls.length) {
      throw new Error('No valid URL found for /download')
    }

    const parsed = await this.scrape(urls, params)

    if (!Array.isArray(parsed) || !parsed.length) {
      throw new Error(`No downloadable content returned for ${urls.join(', ')}`)
    }

    const filesMap = this.getNodeFiles(node)
    const nodeFiles = Object.keys(filesMap)

    const contentHashMap = new Map(
      Object.entries(this.store._files).map(([fileId, content]) => [this.hash(content), {id: fileId}]),
    )

    const duplicatedFiles = []
    const newFilesData = []

    // Split into matched and unmatched results
    parsed.forEach(result => {
      const existingFile = contentHashMap.get(this.hash(result.content))

      if (existingFile && !nodeFiles.includes(existingFile.id)) {
        duplicatedFiles.push(
          this.store.createNode({
            parent: node.id,
            file: existingFile.id,
            title: existingFile.filename || result.filename,
          }),
        )
      } else if (!existingFile) {
        newFilesData.push(result)
      }
    })

    if (newFilesData.length) {
      const results = await Promise.allSettled(newFilesData.map(data => this.saveFile(node, data)))
      const failed = results.find(result => result.status === 'rejected')
      if (failed) {
        throw failed.reason
      }
      return
    }

    if (duplicatedFiles.length) {
      this.store.importer.createNodes(formatDownloadConfirmation(duplicatedFiles), node.id)
      return
    }

    throw new Error(`Downloaded content already exists on this node for ${urls.join(', ')}`)
  }

  async run(node, originalPrompt) {
    return runWithErrorNode(this.store, node, this.logError.bind(this), async () => {
      let prompt = originalPrompt
      const command = node?.command || node?.title

      if (!prompt || referencePatterns.withAssignmentPrefix().test(command)) {
        prompt = substituteReferencesAndHashrefsChildrenAndSelf(this.store.getNode(node.id), this.store)
      } else {
        prompt = clearCommandsWithParams(
          clearReferences(clearReferences(clearStepsPrefix(prompt), REF_DEF_PREFIX), HASHREF_DEF_PREFIX),
        )
      }

      const params = {
        max_size: readMaxSizeParam(command),
        max_pages: readMaxPagesParam(command),
      }

      await this.insertFileToWorkflow(node, prompt, params)
    })
  }
}

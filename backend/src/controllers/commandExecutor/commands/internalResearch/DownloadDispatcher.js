import debug from 'debug'
import {Readable} from 'stream'
import {scrapeFiles} from '../../../utils/scrape'
import {readMaxPagesParam, readMaxSizeParam} from '../../constants/download'
import {substituteReferencesAndHashrefsChildrenAndSelf} from '../references/substitution'
import WorkflowFile from '../../../../models/WorkflowFile'
import {runWithErrorNode} from '../shared/runWithErrorNode'
import {getNodeCommand} from '../utils/isCommand'

const log = debug('delta5:app:Command:internalResearch:DownloadDispatcher')

const extractUrls = input => {
  const raw = input.match(/\bhttps?:\/\/[^\s)]+/g) || []
  return [
    ...new Set(
      raw
        .map(u => u.replace(/[.,!?;:]+$/, ''))
        .map(u => {
          try {
            return new URL(u).href.replace(/\/$/, '')
          } catch {
            return null
          }
        })
        .filter(Boolean),
    ),
  ]
}

const fnvHash = str => {
  const CHUNK = 64 * 1024
  const data = new TextEncoder().encode(str)
  let startChunk = new Uint8Array(0)
  let endChunk = new Uint8Array(CHUNK)
  let total = 0
  let endOffset = 0

  for (let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.slice(i, i + CHUNK)
    total += chunk.length

    if (startChunk.length < CHUNK) {
      const remaining = CHUNK - startChunk.length
      startChunk = new Uint8Array([...startChunk, ...chunk.slice(0, remaining)])
    }

    if (total >= CHUNK) {
      const space = CHUNK - endOffset
      if (chunk.length <= space) {
        endChunk.set(chunk, endOffset)
        endOffset += chunk.length
      } else {
        endChunk.set(chunk.slice(chunk.length - CHUNK), 0)
        endOffset = CHUNK
      }
    }
  }

  const combined = new Uint8Array(startChunk.length + endChunk.length)
  combined.set(startChunk)
  combined.set(endChunk, startChunk.length)

  let hash = 0x811c9dc5
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash ^ combined[i]) * 0x01000193) >>> 0
  }
  return (hash >>> 0).toString(16)
}

const fileNodeIdsByParent = (node, store) =>
  Object.values(store._nodes)
    .filter(n => n.parent === node.id && n.file)
    .map(n => n.file)

const contentHashIndex = store => new Map(Object.entries(store._files).map(([id, content]) => [fnvHash(content), id]))

const persistFileNode = async (store, node, userId, workflowId, {filename, content}) => {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8')
  const result = await WorkflowFile.write(
    {filename, metadata: {workflowId, contentType: 'text/plain', userId}},
    Readable.from(buffer),
  )
  const fileId = result._id.toString()
  store.createNode({file: fileId, title: filename, parent: node.id})
  store.createFile(fileId, content)
}

const confirmDuplicates = (store, node, duplicates) => {
  const names = duplicates.map(f => f.title).filter(Boolean)
  const msg = names.length
    ? `Downloaded content already attached: ${names.join(', ')}`
    : 'Downloaded content is already attached to this node'
  store.importer.createNodes(msg, node.id)
}

const persistResults = async (store, node, userId, workflowId, scraped) => {
  const hashIndex = contentHashIndex(store)
  const existingFileIds = fileNodeIdsByParent(node, store)

  const duplicates = []
  const newFiles = []

  scraped.forEach(result => {
    const existingId = hashIndex.get(fnvHash(result.content))
    if (existingId && !existingFileIds.includes(existingId)) {
      duplicates.push(store.createNode({parent: node.id, file: existingId, title: result.filename}))
    } else if (!existingId) {
      newFiles.push(result)
    }
  })

  if (newFiles.length) {
    const results = await Promise.allSettled(
      newFiles.map(data => persistFileNode(store, node, userId, workflowId, data)),
    )
    const failed = results.find(r => r.status === 'rejected')
    if (failed) throw failed.reason
    return
  }

  if (duplicates.length) {
    confirmDuplicates(store, node, duplicates)
    return
  }

  throw new Error(`Downloaded content already exists on this node for ${scraped.map(r => r.filename).join(', ')}`)
}

export const dispatchDownload = async (cell, store) => {
  const logError = log.extend('ERROR*', '::')
  await runWithErrorNode(store, cell, logError, async () => {
    const command = getNodeCommand(cell)
    const prompt = substituteReferencesAndHashrefsChildrenAndSelf(store.getNode(cell.id), store)

    const params = {
      max_size: readMaxSizeParam(command),
      max_pages: readMaxPagesParam(command),
    }

    const urls = extractUrls(prompt)
    if (!urls.length) throw new Error('No valid URL found for /download')

    const scraped = await scrapeFiles(urls, params)
    if (!Array.isArray(scraped) || !scraped.length) {
      throw new Error(`No downloadable content returned for ${urls.join(', ')}`)
    }

    await persistResults(store, cell, store._userId, store._workflowId, scraped)
  })
}

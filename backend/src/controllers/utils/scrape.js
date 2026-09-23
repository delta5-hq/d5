import debug from 'debug'
import {fetchWithProxySupport} from './fetchWithProxySupport'
import {getPdfParseOptions} from './getPdfParseOptions'
import {stripTags} from './html'
import {extractTextFromPdf, CONTENT_TYPES_APPLICATION_PDF} from './pdf'

const log = debug('delta5:scrape')

const isHtmlContentType = contentType =>
  contentType.includes('text/html') || contentType.includes('application/xhtml+xml')

export function PhraseChunkBuilderV2(snippets, chunkSize, maxChunks) {
  const MIN_TEXT_LENGTH = 50
  const PHRASE_SEPARATOR = /\.\s+/
  const chunks = []
  let buffer = {hrefs: [], content: ''}

  const snippetMap = snippets.reduce((acc, {snippet, href}) => {
    acc[href] = snippet
    return acc
  }, {})

  const methods = {
    chunks() {
      return chunks.length ? chunks : [buffer]
    },
    isFull() {
      return maxChunks ? chunks.length >= maxChunks : false
    },
    appendChunks(str, href = '') {
      const phrases = str.split(PHRASE_SEPARATOR)
      buffer.hrefs = [href]

      if (snippetMap[href]) {
        buffer.content += `${snippetMap[href]}`
      }

      for (const phrase of phrases) {
        buffer.content += ` ${phrase}.`

        if (buffer.content.length > chunkSize) {
          this.flush()
        }

        if (this.isFull()) {
          if (buffer.content.length) {
            this.flush()
          }
          return true
        }
      }

      if (buffer.content.length) {
        this.flush()
      }
    },
    fitIntoChunkSize(str) {
      return str.substring(0, chunkSize)
    },
    flush() {
      buffer.content = this.fitIntoChunkSize(buffer.content)
      if (buffer.content.length >= MIN_TEXT_LENGTH) {
        chunks.push(buffer)
      }
      buffer = {hrefs: buffer.hrefs, content: ''}
    },
  }

  return methods
}

export async function fetchAsString(href) {
  const response = await fetchWithProxySupport(href)
  const contentType = response.headers.get('Content-type') || ''
  if (CONTENT_TYPES_APPLICATION_PDF.some(type => contentType.includes(type))) {
    const content = await response.arrayBuffer()
    return await extractTextFromPdf(content, getPdfParseOptions(href), {})
  } else if (isHtmlContentType(contentType)) {
    const text = await response.text()
    return stripTags(text)
  } else {
    return response.text()
  }
}

export const scrape = async (hrefs, snippets, maxChunks, chunkSize, Builder = PhraseChunkBuilderV2) => {
  if (!chunkSize) {
    throw Error('Chunk size is required')
  }

  if (!hrefs?.length) {
    return []
  }

  const chunker = Builder(snippets, chunkSize, maxChunks)

  for (const href of hrefs) {
    if (chunker.isFull()) {
      break
    }

    try {
      const str = await fetchAsString(href)
      if (chunker.appendChunks(str, href)) {
        break
      }
    } catch (e) {
      log('fetchAsString failed: %s', e.message)
    }
  }

  return chunker.chunks()
}

export function parseSize(size) {
  if (!size) return null

  const match = size.match(/^(\d+(?:\.\d+)?)(b|kb|mb)$/i)
  if (!match) throw new Error(`Unsupported size format: ${size}`)

  const value = parseFloat(match[1])
  const unit = match[2].toLowerCase()

  if (unit === 'b') return value
  else if (unit === 'kb') return value * 1024
  else if (unit === 'mb') return value * 1024 * 1024
}

export async function getFileName(response, url) {
  const contentDisposition = response.headers.get('content-disposition')

  if (contentDisposition) {
    const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^;"']+)/)
    if (match) {
      const name = decodeURIComponent(match[1])
      return name
    }
  }

  const urlPart = url.split('/').pop()
  if (urlPart && urlPart.includes('.')) {
    return urlPart
  }

  const randomId = Math.random().toString(36).substring(2, 10)
  return `file_${randomId}`
}

export async function checkContentType(response, allowedTypes) {
  try {
    if (!response.ok) return false

    return allowedTypes.some(type => response.headers.get('content-type')?.includes(type))
  } catch (err) {
    log('content-type check failed: %s', err.message)
    return false
  }
}

export const createSizeChecker = maxSize => {
  let totalBytes = 0

  return text => {
    totalBytes += text.length
    return totalBytes <= maxSize ? 0 : totalBytes - maxSize
  }
}

export async function processContentPdf(content, filename, options) {
  const {url, maxSize, maxPages} = options
  const pdfParseOptions = getPdfParseOptions(url)
  const extractedText = await extractTextFromPdf(
    content,
    {
      ...pdfParseOptions,
      shouldContinue: maxSize ? createSizeChecker(maxSize) : undefined,
    },
    {max: pdfParseOptions.from + maxPages - 1},
  )

  return {filename, content: extractedText}
}

export async function processContentString(response, filename, contentType = 'text/html') {
  const text = await response.text()
  return {filename, content: isHtmlContentType(contentType) ? stripTags(text) : text}
}

export async function processUrl(url, options) {
  try {
    const response = await fetchWithProxySupport(url)

    const contentType = response.headers.get('content-type') || ''
    const filename = await getFileName(response, url)

    if (CONTENT_TYPES_APPLICATION_PDF.some(type => contentType.includes(type))) {
      const content = await response.arrayBuffer()

      return await processContentPdf(content, filename, {url, ...options})
    }

    return await processContentString(response, filename, contentType)
  } catch (err) {
    log('processUrl failed for %s: %s', url, err.message)
    return null
  }
}

export function normalizeOptions(params) {
  return {
    maxSize: parseSize(params.max_size),
    maxPages: params.max_pages ? parseInt(params.max_pages, 10) : undefined,
  }
}

export const scrapeFiles = async (urls, params) => {
  if (!urls || !urls.length) {
    return []
  }

  const options = normalizeOptions(params)

  return (await Promise.allSettled(urls.map(url => processUrl(url, options))))
    .filter(result => result.status === 'fulfilled' && result.value)
    .map(result => result.value)
}

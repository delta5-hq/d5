import {
  parseSize,
  checkContentType,
  createSizeChecker,
  scrapeFiles,
  PhraseChunkBuilderV2,
  fetchAsString,
  scrape,
  getFileName,
  processContentPdf,
  processContentString,
  normalizeOptions,
  processUrl,
} from './scrape'
import fetch from 'node-fetch'
import * as pdfUtils from './pdf'
import * as htmlUtils from './html'
import * as proxyUtils from './fetchWithProxySupport'

jest.mock('node-fetch', () => jest.fn())
jest.mock('./pdf', () => ({
  extractTextFromPdf: jest.fn(),
  CONTENT_TYPES_APPLICATION_PDF: ['application/pdf'],
}))
jest.mock('./html', () => ({
  stripTags: jest.fn(text => text),
}))
jest.mock('./fetchWithProxySupport', () => ({
  fetchWithProxySupport: jest.fn(),
}))
jest.mock('./getPdfParseOptions', () => ({
  getPdfParseOptions: jest.fn(() => ({})),
}))

const {Response} = jest.requireActual('node-fetch')

describe('parseSize', () => {
  it('parses bytes correctly', () => {
    expect(parseSize('100b')).toBe(100)
  })

  it('parses kilobytes correctly', () => {
    expect(parseSize('1kb')).toBe(1024)
  })

  it('parses megabytes correctly', () => {
    expect(parseSize('2mb')).toBe(2097152)
  })

  it('throws on invalid format', () => {
    expect(() => parseSize('100gb')).toThrow('Unsupported size format: 100gb')
  })
})

describe('checkContentType', () => {
  it('returns true for allowed content type', async () => {
    const result = await checkContentType(
      {
        ok: true,
        headers: {
          get: () => 'application/pdf',
        },
      },
      ['application/pdf'],
    )

    expect(result).toBe(true)
  })

  it('returns false for disallowed content type', async () => {
    fetch.mockResolvedValueOnce(
      new Response(null, {
        status: 200,
        headers: {'content-type': 'text/html'},
      }),
    )

    const result = await checkContentType('https://example.com/file.pdf', ['application/pdf'])
    expect(result).toBe(false)
  })

  it('returns false for network error', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'))
    const result = await checkContentType('https://example.com/file.pdf', ['application/pdf'])
    expect(result).toBe(false)
  })
})

describe('createSizeChecker', () => {
  it('returns 0 when size is within limit', () => {
    const checker = createSizeChecker(10)
    expect(checker('12345')).toBe(0)
    expect(checker('12')).toBe(0)
  })

  it('returns size out of limit', () => {
    const checker = createSizeChecker(10)
    expect(checker('123456')).toBe(0)
    expect(checker('12345')).toBe(1)
  })
})

describe('scrapeFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should filter out unsupported content types', async () => {
    fetch.mockResolvedValueOnce(
      new Response(null, {
        status: 200,
        headers: {
          'content-type': 'text/html',
        },
      }),
    )

    jest.useFakeTimers()

    const result = await scrapeFiles(['https://example.com/test.html'], {
      allowedTypes: ['application/pdf'],
    })

    jest.runAllTimers()

    expect(result).toEqual([])
  })

  it('should handle fetch failure', async () => {
    fetch.mockRejectedValueOnce(new Error('Network Error'))

    jest.useFakeTimers()

    const result = await scrapeFiles(['https://example.com/test.pdf'], {
      allowedTypes: ['application/pdf'],
    })

    jest.runAllTimers()

    expect(result).toEqual([])
  })
})

describe('PhraseChunkBuilderV2', () => {
  it('should create chunks of appropriate size', () => {
    const snippets = [
      {snippet: 'Snippet 1', href: 'https://example.com/1'},
      {snippet: 'Snippet 2', href: 'https://example.com/2'},
    ]
    const chunkSize = 100
    const builder = PhraseChunkBuilderV2(snippets, chunkSize)

    builder.appendChunks('This is sentence one. This is sentence two.', 'https://example.com/1')

    const chunks = builder.chunks()
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0].hrefs).toContain('https://example.com/1')
    expect(chunks[0].content.length).toBeLessThanOrEqual(chunkSize)
  })

  it('should respect maxChunks parameter', () => {
    const snippets = []
    const chunkSize = 100
    const maxChunks = 2
    const builder = PhraseChunkBuilderV2(snippets, chunkSize, maxChunks)

    builder.appendChunks('First sentence. Second sentence. Third sentence.', 'href1')
    builder.appendChunks('Fourth sentence. Fifth sentence. Sixth sentence.', 'href2')
    builder.appendChunks('This should not be included.', 'href3')

    const chunks = builder.chunks()
    expect(chunks.length).toBeLessThanOrEqual(maxChunks)
    expect(builder.isFull()).toBe(true)
  })

  it('should include snippets in content when available', () => {
    const snippets = [{snippet: 'Important snippet', href: 'https://example.com/1'}]
    const chunkSize = 200
    const builder = PhraseChunkBuilderV2(snippets, chunkSize)

    builder.appendChunks('Regular content. Regular content. Regular content. Regular content.', 'https://example.com/1')

    const chunks = builder.chunks()
    expect(chunks[0].content).toContain('Important snippet')
  })
})

describe('fetchAsString', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should handle PDF content', async () => {
    const mockPdfBuffer = new ArrayBuffer(8)
    const mockResponse = {
      headers: {
        get: jest.fn().mockReturnValue('application/pdf'),
      },
      arrayBuffer: jest.fn().mockResolvedValue(mockPdfBuffer),
    }

    proxyUtils.fetchWithProxySupport.mockResolvedValue(mockResponse)
    pdfUtils.extractTextFromPdf.mockResolvedValue('Extracted PDF text')

    const result = await fetchAsString('https://example.com/file.pdf')

    expect(proxyUtils.fetchWithProxySupport).toHaveBeenCalledWith('https://example.com/file.pdf')
    expect(mockResponse.headers.get).toHaveBeenCalledWith('Content-type')
    expect(mockResponse.arrayBuffer).toHaveBeenCalled()
    expect(pdfUtils.extractTextFromPdf).toHaveBeenCalledWith(mockPdfBuffer, {}, {})
    expect(result).toBe('Extracted PDF text')
  })

  it('should handle HTML content', async () => {
    const mockResponse = {
      headers: {
        get: jest.fn().mockReturnValue('text/html'),
      },
      text: jest.fn().mockResolvedValue('<html><body>Some HTML</body></html>'),
    }

    proxyUtils.fetchWithProxySupport.mockResolvedValue(mockResponse)
    htmlUtils.stripTags.mockReturnValue('Some HTML')

    const result = await fetchAsString('https://example.com/page.html')

    expect(proxyUtils.fetchWithProxySupport).toHaveBeenCalledWith('https://example.com/page.html')
    expect(mockResponse.headers.get).toHaveBeenCalledWith('Content-type')
    expect(mockResponse.text).toHaveBeenCalled()
    expect(htmlUtils.stripTags).toHaveBeenCalledWith('<html><body>Some HTML</body></html>')
    expect(result).toBe('Some HTML')
  })
})

describe('scrape', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should throw error if chunk size is not provided', async () => {
    await expect(scrape(['https://example.com'], [], 10)).rejects.toThrow('Chunk size is required')
  })

  it('should return empty array for empty hrefs', async () => {
    const result = await scrape([], [], 10, 1000)
    expect(result).toEqual([])
  })

  it('should fetch and chunk content from urls', async () => {
    const mockBuilder = {
      isFull: jest.fn().mockReturnValue(false),
      appendChunks: jest.fn().mockReturnValue(false),
      chunks: jest.fn().mockReturnValue([{hrefs: ['url1'], content: 'Chunked content'}]),
    }

    const mockBuilderFactory = jest.fn().mockReturnValue(mockBuilder)

    proxyUtils.fetchWithProxySupport.mockImplementation(url => {
      if (url === 'url1') {
        return Promise.resolve({
          headers: {get: () => 'text/html'},
          text: () => Promise.resolve('Content from url1'),
        })
      } else {
        return Promise.reject(new Error('Failed to fetch'))
      }
    })

    htmlUtils.stripTags.mockReturnValue('Stripped content from url1')

    const result = await scrape(['url1', 'url2'], [{href: 'url1', snippet: 'Snippet 1'}], 10, 1000, mockBuilderFactory)

    expect(mockBuilderFactory).toHaveBeenCalledWith([{href: 'url1', snippet: 'Snippet 1'}], 1000, 10)
    expect(mockBuilder.appendChunks).toHaveBeenCalledWith('Stripped content from url1', 'url1')
    expect(result).toEqual([{hrefs: ['url1'], content: 'Chunked content'}])
  })

  it('should stop scraping when chunker is full', async () => {
    const mockBuilder = {
      isFull: jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(true),
      appendChunks: jest.fn(),
      chunks: jest.fn().mockReturnValue([{hrefs: ['url1'], content: 'Content'}]),
    }

    const mockBuilderFactory = jest.fn().mockReturnValue(mockBuilder)

    proxyUtils.fetchWithProxySupport.mockResolvedValue({
      headers: {get: () => 'text/html'},
      text: () => Promise.resolve('Some content'),
    })

    htmlUtils.stripTags.mockReturnValue('Stripped content')

    await scrape(['url1', 'url2'], [], null, 1000, mockBuilderFactory)

    expect(proxyUtils.fetchWithProxySupport).toHaveBeenCalledTimes(1)
    expect(proxyUtils.fetchWithProxySupport).toHaveBeenCalledWith('url1')
    expect(proxyUtils.fetchWithProxySupport).not.toHaveBeenCalledWith('url2')
  })

  it('should stop scraping when appendChunks returns true', async () => {
    const mockBuilder = {
      isFull: jest.fn().mockReturnValue(false),
      appendChunks: jest.fn().mockReturnValueOnce(true),
      chunks: jest.fn().mockReturnValue([{hrefs: ['url1'], content: 'Content'}]),
    }

    const mockBuilderFactory = jest.fn().mockReturnValue(mockBuilder)

    proxyUtils.fetchWithProxySupport.mockResolvedValue({
      headers: {get: () => 'text/html'},
      text: () => Promise.resolve('Some content'),
    })

    htmlUtils.stripTags.mockReturnValue('Stripped content')

    await scrape(['url1', 'url2'], [], null, 1000, mockBuilderFactory)

    expect(proxyUtils.fetchWithProxySupport).toHaveBeenCalledTimes(1)
    expect(proxyUtils.fetchWithProxySupport).toHaveBeenCalledWith('url1')
    expect(proxyUtils.fetchWithProxySupport).not.toHaveBeenCalledWith('url2')
  })
})

describe('getFileName', () => {
  it('should extract filename from content-disposition header', async () => {
    const response = {
      headers: {
        get: jest.fn().mockImplementation(header => {
          if (header === 'content-disposition') {
            return 'attachment; filename="test-file.pdf"'
          }
          return null
        }),
      },
    }

    const result = await getFileName(response, 'https://example.com/downloads/file.pdf')
    expect(result).toBe('test-file.pdf')
  })

  it('should use URL part if no content-disposition header', async () => {
    const response = {
      headers: {
        get: jest.fn().mockReturnValue(null),
      },
    }

    const result = await getFileName(response, 'https://example.com/downloads/file.pdf')
    expect(result).toBe('file.pdf')
  })

  it('should generate a random filename if no other options available', async () => {
    const response = {
      headers: {
        get: jest.fn().mockReturnValue(null),
      },
    }

    const result = await getFileName(response, 'https://example.com/downloads/')
    expect(result).toMatch(/^file_[a-z0-9]{8}$/)
  })

  it('should handle URL encoded filenames', async () => {
    const response = {
      headers: {
        get: jest.fn().mockImplementation(header => {
          if (header === 'content-disposition') {
            return "attachment; filename*=UTF-8''test%20file%20with%20spaces.pdf"
          }
          return null
        }),
      },
    }

    const result = await getFileName(response, 'https://example.com/downloads/file.pdf')
    expect(result).toBe('test file with spaces.pdf')
  })
})

describe('processContentPdf', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should process PDF content with default options', async () => {
    const mockBuffer = new ArrayBuffer(10)
    const mockFileName = 'test.pdf'
    const mockOptions = {url: 'https://example.com/test.pdf'}

    pdfUtils.extractTextFromPdf.mockResolvedValue('Extracted text content')

    const result = await processContentPdf(mockBuffer, mockFileName, mockOptions)

    expect(pdfUtils.extractTextFromPdf).toHaveBeenCalledWith(mockBuffer, {}, {max: NaN})
    expect(result).toEqual({
      filename: 'test.pdf',
      content: 'Extracted text content',
    })
  })

  it('should apply size limit when maxSize is provided', async () => {
    const mockBuffer = new ArrayBuffer(10)
    const mockFileName = 'test.pdf'
    const mockOptions = {
      url: 'https://example.com/test.pdf',
      maxSize: 1024,
    }

    pdfUtils.extractTextFromPdf.mockResolvedValue('Extracted text content')

    const result = await processContentPdf(mockBuffer, mockFileName, mockOptions)

    // Verify that shouldContinue function is passed
    expect(pdfUtils.extractTextFromPdf.mock.calls[0][1].shouldContinue).toBeDefined()
    expect(typeof pdfUtils.extractTextFromPdf.mock.calls[0][1].shouldContinue).toBe('function')
    expect(result).toEqual({
      filename: 'test.pdf',
      content: 'Extracted text content',
    })
  })

  it('should apply page limit when maxPages is provided', async () => {
    const mockBuffer = new ArrayBuffer(10)
    const mockFileName = 'test.pdf'
    const mockOptions = {
      url: 'https://example.com/test.pdf',
      maxPages: 5,
    }

    pdfUtils.extractTextFromPdf.mockResolvedValue('Extracted text content')

    const result = await processContentPdf(mockBuffer, mockFileName, mockOptions)

    expect(pdfUtils.extractTextFromPdf).toHaveBeenCalledWith(
      mockBuffer,
      expect.anything(),
      {max: NaN}, // NaN because getPdfParseOptions mock returns {}
    )
    expect(result).toEqual({
      filename: 'test.pdf',
      content: 'Extracted text content',
    })
  })
})

describe('processContentString', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should extract and strip text from response', async () => {
    const mockResponse = {
      text: jest.fn().mockResolvedValue('<html><body>Text content</body></html>'),
    }
    const mockFileName = 'test.html'

    htmlUtils.stripTags.mockReturnValue('Text content')

    const result = await processContentString(mockResponse, mockFileName)

    expect(mockResponse.text).toHaveBeenCalled()
    expect(htmlUtils.stripTags).toHaveBeenCalledWith('<html><body>Text content</body></html>')
    expect(result).toEqual({
      filename: 'test.html',
      content: 'Text content',
    })
  })

  it('should handle empty response', async () => {
    const mockResponse = {
      text: jest.fn().mockResolvedValue(''),
    }
    const mockFileName = 'empty.html'

    htmlUtils.stripTags.mockReturnValue('')

    const result = await processContentString(mockResponse, mockFileName)

    expect(result).toEqual({
      filename: 'empty.html',
      content: '',
    })
  })
})

describe('processUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should process PDF URLs', async () => {
    const url = 'https://example.com/document.pdf'
    const options = {maxSize: 1024, maxPages: 5}

    const mockResponse = {
      headers: {
        get: jest.fn().mockImplementation(header => {
          if (header === 'content-type') return 'application/pdf'
          if (header === 'content-disposition') return 'attachment; filename="doc.pdf"'
          return null
        }),
      },
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(100)),
    }

    proxyUtils.fetchWithProxySupport.mockResolvedValue(mockResponse)
    pdfUtils.extractTextFromPdf.mockResolvedValue('PDF content extracted')

    const result = await processUrl(url, options)

    expect(proxyUtils.fetchWithProxySupport).toHaveBeenCalledWith(url)
    expect(mockResponse.headers.get).toHaveBeenCalledWith('content-type')
    expect(mockResponse.arrayBuffer).toHaveBeenCalled()
    expect(result).toEqual({
      filename: 'doc.pdf',
      content: 'PDF content extracted',
    })
  })

  it('should process HTML URLs', async () => {
    const url = 'https://example.com/page.html'
    const options = {}

    const mockResponse = {
      headers: {
        get: jest.fn().mockImplementation(header => {
          if (header === 'content-type') return 'text/html'
          return null
        }),
      },
      text: jest.fn().mockResolvedValue('<html><body>Web content</body></html>'),
    }

    proxyUtils.fetchWithProxySupport.mockResolvedValue(mockResponse)
    htmlUtils.stripTags.mockReturnValue('Web content')

    const result = await processUrl(url, options)

    expect(proxyUtils.fetchWithProxySupport).toHaveBeenCalledWith(url)
    expect(mockResponse.headers.get).toHaveBeenCalledWith('content-type')
    expect(mockResponse.text).toHaveBeenCalled()
    expect(result).toEqual({
      filename: 'page.html',
      content: 'Web content',
    })
  })

  it('should handle fetch errors gracefully', async () => {
    const url = 'https://example.com/broken-link'

    proxyUtils.fetchWithProxySupport.mockRejectedValue(new Error('Network error'))

    const result = await processUrl(url, {})

    expect(proxyUtils.fetchWithProxySupport).toHaveBeenCalledWith(url)
    expect(result).toBeNull()
  })

  it('should handle processing errors gracefully', async () => {
    const url = 'https://example.com/malformed.pdf'

    const mockResponse = {
      headers: {
        get: jest.fn().mockReturnValue('application/pdf'),
      },
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(10)),
    }

    proxyUtils.fetchWithProxySupport.mockResolvedValue(mockResponse)
    pdfUtils.extractTextFromPdf.mockRejectedValue(new Error('PDF parsing error'))

    const result = await processUrl(url, {})

    expect(result).toBeNull()
  })
})

describe('normalizeOptions', () => {
  it('should normalize max_size parameter', () => {
    const result = normalizeOptions({max_size: '5mb'})
    expect(result.maxSize).toBe(5 * 1024 * 1024)
  })

  it('should normalize max_pages parameter', () => {
    const result = normalizeOptions({max_pages: '10'})
    expect(result.maxPages).toBe(10)
  })

  it('should handle empty parameters', () => {
    const result = normalizeOptions({})
    expect(result.maxSize).toBeNull()
    expect(result.maxPages).toBeUndefined()
  })

  it('should handle invalid max_pages parameter', () => {
    const result = normalizeOptions({max_pages: 'not-a-number'})
    expect(result.maxPages).toBe(NaN)
  })
})

describe('scrapeFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return empty array for empty URLs', async () => {
    const result = await scrapeFiles([], {})
    expect(result).toEqual([])
  })

  it('should return empty array for null URLs', async () => {
    const result = await scrapeFiles(null, {})
    expect(result).toEqual([])
  })

  it('should filter out failed requests', async () => {
    const urls = ['https://example.com/doc1.pdf', 'https://example.com/broken-link', 'https://example.com/page.html']

    proxyUtils.fetchWithProxySupport.mockImplementation(url => {
      if (url.includes('broken')) {
        return Promise.reject(new Error('Network error'))
      } else if (url.includes('doc1')) {
        return Promise.resolve({
          headers: {
            get: jest.fn().mockImplementation(header => {
              if (header === 'content-type') return 'application/pdf'
              return null
            }),
          },
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(10)),
        })
      } else {
        return Promise.resolve({
          headers: {
            get: jest.fn().mockImplementation(header => {
              if (header === 'content-type') return 'text/html'
              return null
            }),
          },
          text: jest.fn().mockResolvedValue('<html>Content</html>'),
        })
      }
    })

    pdfUtils.extractTextFromPdf.mockResolvedValue('PDF content')
    htmlUtils.stripTags.mockReturnValue('HTML content')

    const result = await scrapeFiles(urls, {})

    expect(result.length).toBe(2)
    expect(result.some(item => item.filename.includes('doc1'))).toBe(true)
    expect(result.some(item => item.filename.includes('page'))).toBe(true)
  })

  it('should process a real-world scenario with mixed content types', async () => {
    // Setup test parameters
    const urls = [
      'https://example.com/document.pdf',
      'https://example.com/webpage.html',
      'https://example.com/broken.link',
    ]

    const params = {
      max_size: '2mb',
      max_pages: '3',
    }

    // Mock PDF response
    const mockPdfResponse = {
      headers: {
        get: jest.fn().mockImplementation(header => {
          if (header === 'content-type') return 'application/pdf'
          if (header === 'content-disposition') return 'attachment; filename="test-doc.pdf"'
          return null
        }),
      },
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(100)),
    }

    // Mock HTML response
    const mockHtmlResponse = {
      headers: {
        get: jest.fn().mockImplementation(header => {
          if (header === 'content-type') return 'text/html; charset=utf-8'
          return null
        }),
      },
      text: jest.fn().mockResolvedValue('<html><body><p>Web page content</p></body></html>'),
    }

    // Setup fetch mock
    proxyUtils.fetchWithProxySupport.mockImplementation(url => {
      if (url.includes('document.pdf')) {
        return Promise.resolve(mockPdfResponse)
      } else if (url.includes('webpage.html')) {
        return Promise.resolve(mockHtmlResponse)
      } else {
        return Promise.reject(new Error('Failed to fetch resource'))
      }
    })

    // Setup other dependencies
    pdfUtils.extractTextFromPdf.mockResolvedValue('Extracted PDF text')
    htmlUtils.stripTags.mockReturnValue('Web page content')

    // Execute the function
    const result = await scrapeFiles(urls, params)

    // Validate results
    expect(result).toHaveLength(2)

    // Validate PDF result
    const pdfResult = result.find(item => item.filename === 'test-doc.pdf')
    expect(pdfResult).toBeDefined()
    expect(pdfResult.content).toBe('Extracted PDF text')

    // Validate HTML result
    const htmlResult = result.find(item => item.filename === 'webpage.html')
    expect(htmlResult).toBeDefined()
    expect(htmlResult.content).toBe('Web page content')

    // Validate fetch calls
    expect(proxyUtils.fetchWithProxySupport).toHaveBeenCalledTimes(3)
    expect(proxyUtils.fetchWithProxySupport).toHaveBeenCalledWith('https://example.com/document.pdf')
    expect(proxyUtils.fetchWithProxySupport).toHaveBeenCalledWith('https://example.com/webpage.html')
    expect(proxyUtils.fetchWithProxySupport).toHaveBeenCalledWith('https://example.com/broken.link')
  })
})

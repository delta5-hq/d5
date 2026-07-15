import {z} from 'zod'
import {ScrapeTool} from '../../tools/ScrapeTool'
import * as scrape from '../../../../controllers/utils/scrape'

jest.mock('../../../../controllers/utils/scrape', () => ({
  scrapeFiles: jest.fn(),
}))

describe('ScrapeTool', () => {
  let tool

  beforeEach(() => {
    tool = new ScrapeTool()
    jest.clearAllMocks()
  })

  describe('Zod shape', () => {
    it('exposes urls/text/maxSize/maxPages fields', () => {
      const shape = tool.getZodShape()

      expect(shape.urls).toBeDefined()
      expect(shape.text).toBeDefined()
      expect(shape.maxSize).toBeDefined()
      expect(shape.maxPages).toBeDefined()
    })
  })

  describe('execute', () => {
    it('scrapes from urls array', async () => {
      const mockResults = [{filename: 'example.txt', content: 'Hello World'}]
      scrape.scrapeFiles.mockResolvedValue(mockResults)

      const result = await tool.execute({urls: ['https://example.com']})

      expect(scrape.scrapeFiles).toHaveBeenCalledWith(['https://example.com'], {
        max_size: '5mb',
        max_pages: '100',
      })
      expect(result.content[0].text).toContain('example.txt')
      expect(result.content[0].text).toContain('Hello World')
    })

    it('extracts URLs from text when urls not provided', async () => {
      const mockResults = [{filename: 'example.txt', content: 'Content'}]
      scrape.scrapeFiles.mockResolvedValue(mockResults)

      await tool.execute({text: 'Check https://example.com for info'})

      expect(scrape.scrapeFiles).toHaveBeenCalledWith(['https://example.com'], expect.any(Object))
    })

    it('prefers urls array over text extraction', async () => {
      const mockResults = [{filename: 'test.txt', content: 'Content'}]
      scrape.scrapeFiles.mockResolvedValue(mockResults)

      await tool.execute({
        urls: ['https://provided.com'],
        text: 'https://extracted.com',
      })

      expect(scrape.scrapeFiles).toHaveBeenCalledWith(['https://provided.com'], expect.any(Object))
    })

    it('returns message when no URLs provided', async () => {
      const result = await tool.execute({})

      expect(result.content[0].text).toBe('No URLs provided or found in text input.')
      expect(scrape.scrapeFiles).not.toHaveBeenCalled()
    })

    it('returns message when text has no extractable URLs', async () => {
      const result = await tool.execute({text: 'No URLs here'})

      expect(result.content[0].text).toBe('No URLs provided or found in text input.')
      expect(scrape.scrapeFiles).not.toHaveBeenCalled()
    })

    it('returns message when scraping yields no results', async () => {
      scrape.scrapeFiles.mockResolvedValue([])

      const result = await tool.execute({urls: ['https://example.com']})

      expect(result.content[0].text).toBe('No content could be scraped from provided URLs.')
    })

    it('formats multiple results with separators', async () => {
      const mockResults = [
        {filename: 'page1.txt', content: 'Content 1'},
        {filename: 'page2.txt', content: 'Content 2'},
      ]
      scrape.scrapeFiles.mockResolvedValue(mockResults)

      const result = await tool.execute({urls: ['https://example.com']})

      expect(result.content[0].text).toContain('File: page1.txt')
      expect(result.content[0].text).toContain('Content 1')
      expect(result.content[0].text).toContain('---')
      expect(result.content[0].text).toContain('File: page2.txt')
      expect(result.content[0].text).toContain('Content 2')
    })

    it('passes custom maxSize to scrapeFiles', async () => {
      scrape.scrapeFiles.mockResolvedValue([])

      await tool.execute({urls: ['https://example.com'], maxSize: '10mb'})

      expect(scrape.scrapeFiles).toHaveBeenCalledWith(expect.any(Array), {
        max_size: '10mb',
        max_pages: '100',
      })
    })

    it('passes custom maxPages to scrapeFiles', async () => {
      scrape.scrapeFiles.mockResolvedValue([])

      await tool.execute({urls: ['https://example.com'], maxPages: '50'})

      expect(scrape.scrapeFiles).toHaveBeenCalledWith(expect.any(Array), {
        max_size: '5mb',
        max_pages: '50',
      })
    })

    it('handles scraping errors gracefully', async () => {
      scrape.scrapeFiles.mockRejectedValue(new Error('Network timeout'))

      const result = await tool.execute({urls: ['https://example.com']})

      expect(result.content[0].text).toBe('Error: Network timeout')
      expect(result.isError).toBe(true)
    })

    it('handles malformed URL extraction errors', async () => {
      scrape.scrapeFiles.mockRejectedValue(new Error('Invalid URL'))

      const result = await tool.execute({urls: ['not-a-url']})

      expect(result.isError).toBe(true)
    })
  })

  describe('Zod API (getName / getDescription / getZodShape)', () => {
    it('getName() returns expected name', () => {
      expect(tool.getName()).toBe('scrape_web_pages')
    })

    it('getDescription() returns non-empty description', () => {
      expect(typeof tool.getDescription()).toBe('string')
      expect(tool.getDescription().length).toBeGreaterThan(20)
    })

    it('getZodShape() returns an object with parseable ZodType values', () => {
      const shape = tool.getZodShape()

      expect(typeof shape).toBe('object')
      expect(shape).not.toBeNull()
      Object.values(shape).forEach(value => {
        expect(typeof value.safeParse).toBe('function')
        expect(typeof value.parse).toBe('function')
      })
    })

    it('getZodShape() accepts empty object (all fields optional)', () => {
      const shape = tool.getZodShape()
      const schema = z.object(shape)
      expect(schema.safeParse({}).success).toBe(true)
    })

    it('getZodShape returns consistent field set across multiple calls', () => {
      const shape1 = tool.getZodShape()
      const shape2 = tool.getZodShape()
      expect(Object.keys(shape1).sort()).toEqual(Object.keys(shape2).sort())
    })
  })
})

import {ScrapeTool} from '../../tools/ScrapeTool'
import * as scrape from '../../../../controllers/utils/scrape'

jest.mock('../../../../controllers/utils/scrape', () => ({
  scrapeFiles: jest.fn(),
}))

describe('ScrapeTool Delegation Integration', () => {
  let tool

  beforeEach(() => {
    tool = new ScrapeTool()
    jest.clearAllMocks()
  })

  describe('delegation to scrapeFiles', () => {
    it('delegates to scrapeFiles with adapted params', async () => {
      scrape.scrapeFiles.mockResolvedValue([{filename: 'test.txt', content: 'content'}])

      await tool.execute({urls: ['https://example.com'], maxSize: '10mb', maxPages: '50'})

      expect(scrape.scrapeFiles).toHaveBeenCalledWith(['https://example.com'], {
        max_size: '10mb',
        max_pages: '50',
      })
    })

    it('wraps scrapeFiles result in MCP content format', async () => {
      scrape.scrapeFiles.mockResolvedValue([
        {filename: 'page1.txt', content: 'Content 1'},
        {filename: 'page2.txt', content: 'Content 2'},
      ])

      const result = await tool.execute({urls: ['https://example.com']})

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: expect.stringContaining('File: page1.txt'),
          },
        ],
      })
      expect(result.content[0].text).toContain('Content 1')
      expect(result.content[0].text).toContain('---')
      expect(result.content[0].text).toContain('File: page2.txt')
      expect(result.content[0].text).toContain('Content 2')
    })

    it('handles scrapeFiles returning empty array', async () => {
      scrape.scrapeFiles.mockResolvedValue([])

      const result = await tool.execute({urls: ['https://example.com']})

      expect(result.content[0].text).toBe('No content could be scraped from provided URLs.')
    })

    it('handles scrapeFiles throwing error', async () => {
      scrape.scrapeFiles.mockRejectedValue(new Error('Network timeout'))

      const result = await tool.execute({urls: ['https://example.com']})

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toBe('Error: Network timeout')
    })
  })

  describe('URL extraction delegation', () => {
    it('extracts URLs from text before delegating to scrapeFiles', async () => {
      scrape.scrapeFiles.mockResolvedValue([{filename: 'test.txt', content: 'content'}])

      await tool.execute({text: 'Check https://example.com and https://test.org'})

      expect(scrape.scrapeFiles).toHaveBeenCalledWith(
        expect.arrayContaining(['https://example.com', 'https://test.org']),
        expect.any(Object),
      )
    })

    it('prefers explicit urls over text extraction', async () => {
      scrape.scrapeFiles.mockResolvedValue([])

      await tool.execute({
        urls: ['https://explicit.com'],
        text: 'https://extracted.com',
      })

      expect(scrape.scrapeFiles).toHaveBeenCalledWith(['https://explicit.com'], expect.any(Object))
    })
  })

  describe('param adaptation edge cases', () => {
    it('uses defaults when no size params provided', async () => {
      scrape.scrapeFiles.mockResolvedValue([])

      await tool.execute({urls: ['https://example.com']})

      expect(scrape.scrapeFiles).toHaveBeenCalledWith(expect.any(Array), {
        max_size: '5mb',
        max_pages: '100',
      })
    })

    it('preserves exact param values through adapter', async () => {
      scrape.scrapeFiles.mockResolvedValue([])

      await tool.execute({urls: ['https://example.com'], maxSize: '1gb', maxPages: '500'})

      expect(scrape.scrapeFiles).toHaveBeenCalledWith(expect.any(Array), {
        max_size: '1gb',
        max_pages: '500',
      })
    })
  })
})

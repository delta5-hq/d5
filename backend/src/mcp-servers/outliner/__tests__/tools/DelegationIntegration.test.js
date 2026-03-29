import {OutlineTool} from '../../tools/OutlineTool'
import {OutlineCommand} from '../../../../controllers/commandExecutor/commands/OutlineCommand'

jest.mock('../../../../controllers/commandExecutor/commands/OutlineCommand')

describe('OutlineTool Delegation Integration', () => {
  let tool
  let mockUserContext
  let mockOutlineCommand

  beforeEach(() => {
    mockUserContext = {
      getUserId: jest.fn().mockReturnValue('test-user-123'),
    }

    mockOutlineCommand = {
      createResponseOutline: jest.fn(),
    }

    OutlineCommand.mockImplementation(() => mockOutlineCommand)

    tool = new OutlineTool(mockUserContext)
    jest.clearAllMocks()
  })

  describe('delegation to OutlineCommand.createResponseOutline', () => {
    it('delegates with web mode params', async () => {
      mockOutlineCommand.createResponseOutline.mockResolvedValue('Outline')

      await tool.execute({query: 'AI research', web: 's'})

      expect(OutlineCommand).toHaveBeenCalledWith('test-user-123', null, null)
      expect(mockOutlineCommand.createResponseOutline).toHaveBeenCalledWith(
        expect.objectContaining({command: expect.stringContaining('--max-chunks=')}),
        'AI research',
        expect.objectContaining({
          maxChunks: expect.any(Number),
          disableSearchScrape: false,
        }),
      )
    })

    it('delegates with scholar mode params including minYear', async () => {
      mockOutlineCommand.createResponseOutline.mockResolvedValue('Outline')

      await tool.execute({query: 'Physics', scholar: 'm', minYear: 2020})

      expect(mockOutlineCommand.createResponseOutline).toHaveBeenCalledWith(
        expect.any(Object),
        'Physics',
        expect.objectContaining({
          maxChunks: expect.any(Number),
          serpApiParams: expect.objectContaining({as_ylo: 2020}),
        }),
      )
    })

    it('delegates with ext mode disabling search scrape', async () => {
      mockOutlineCommand.createResponseOutline.mockResolvedValue('Outline')

      await tool.execute({query: 'ML', ext: true, context: 'papers'})

      expect(mockOutlineCommand.createResponseOutline).toHaveBeenCalledWith(
        expect.any(Object),
        'ML',
        expect.objectContaining({
          disableSearchScrape: true,
          context: 'papers',
        }),
      )
    })

    it('wraps OutlineCommand result in MCP content format', async () => {
      mockOutlineCommand.createResponseOutline.mockResolvedValue('Structured Outline\n  Item 1\n  Item 2')

      const result = await tool.execute({query: 'Test', web: 's'})

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Structured Outline\n  Item 1\n  Item 2',
          },
        ],
      })
    })

    it('handles OutlineCommand returning empty string', async () => {
      mockOutlineCommand.createResponseOutline.mockResolvedValue('')

      const result = await tool.execute({query: 'Test', web: 's'})

      expect(result.content[0].text).toBe('(empty outline)')
    })

    it('handles OutlineCommand returning null', async () => {
      mockOutlineCommand.createResponseOutline.mockResolvedValue(null)

      const result = await tool.execute({query: 'Test', web: 's'})

      expect(result.content[0].text).toBe('(empty outline)')
    })

    it('handles OutlineCommand throwing error', async () => {
      mockOutlineCommand.createResponseOutline.mockRejectedValue(new Error('LLM API timeout'))

      const result = await tool.execute({query: 'Test', web: 's'})

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toBe('Error: LLM API timeout')
    })
  })

  describe('synthetic node building for LLM routing', () => {
    it('builds node with lang flag', async () => {
      mockOutlineCommand.createResponseOutline.mockResolvedValue('Outline')

      await tool.execute({query: 'Test', web: 's', lang: 'ru'})

      const call = mockOutlineCommand.createResponseOutline.mock.calls[0]
      expect(call[0].command).toContain('--lang=ru')
    })

    it('builds node with citations flag', async () => {
      mockOutlineCommand.createResponseOutline.mockResolvedValue('Outline')

      await tool.execute({query: 'Test', web: 's', citations: true})

      const call = mockOutlineCommand.createResponseOutline.mock.calls[0]
      expect(call[0].command).toContain('--citations')
    })

    it('builds node with context flag', async () => {
      mockOutlineCommand.createResponseOutline.mockResolvedValue('Outline')

      await tool.execute({query: 'Test', ext: true, context: 'kb-context'})

      const call = mockOutlineCommand.createResponseOutline.mock.calls[0]
      expect(call[0].command).toContain('--context=kb-context')
    })

    it('builds node with multiple flags', async () => {
      mockOutlineCommand.createResponseOutline.mockResolvedValue('Outline')

      await tool.execute({query: 'Test', scholar: 'm', lang: 'en', citations: true})

      const call = mockOutlineCommand.createResponseOutline.mock.calls[0]
      expect(call[0].command).toMatch(/--lang=en.*--citations.*--max-chunks=/)
    })
  })

  describe('mode exclusivity enforcement', () => {
    it('scholar mode overrides web mode for maxChunks calculation', async () => {
      mockOutlineCommand.createResponseOutline.mockResolvedValue('Outline')

      await tool.execute({query: 'Test', web: 's', scholar: 'l'})

      const call = mockOutlineCommand.createResponseOutline.mock.calls[0]
      expect(call[2].serpApiParams).toBeDefined()
    })

    it('ext mode disables search scrape regardless of web/scholar', async () => {
      mockOutlineCommand.createResponseOutline.mockResolvedValue('Outline')

      await tool.execute({query: 'Test', web: 's', ext: true})

      const call = mockOutlineCommand.createResponseOutline.mock.calls[0]
      expect(call[2].disableSearchScrape).toBe(true)
    })
  })

  describe('href parameter handling', () => {
    it('converts href to from array', async () => {
      mockOutlineCommand.createResponseOutline.mockResolvedValue('Outline')

      await tool.execute({query: 'Test', href: 'https://example.com'})

      const call = mockOutlineCommand.createResponseOutline.mock.calls[0]
      expect(call[2].from).toEqual(['https://example.com'])
    })

    it('omits from array when href not provided', async () => {
      mockOutlineCommand.createResponseOutline.mockResolvedValue('Outline')

      await tool.execute({query: 'Test', web: 's'})

      const call = mockOutlineCommand.createResponseOutline.mock.calls[0]
      expect(call[2].from).toEqual([])
    })
  })
})

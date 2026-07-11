import {z} from 'zod'
import {OutlineTool} from '../../tools/OutlineTool'
import {OutlineCommand} from '../../../../controllers/commandExecutor/commands/OutlineCommand'

jest.mock('../../../../controllers/commandExecutor/commands/OutlineCommand')

describe('OutlineTool', () => {
  let tool
  let mockUserContextProvider
  let mockOutlineCommand

  beforeEach(() => {
    mockUserContextProvider = {
      getUserId: jest.fn().mockReturnValue('test-user-123'),
      getWorkflowId: jest.fn().mockReturnValue('test-workflow-456'),
    }

    mockOutlineCommand = {
      createResponseOutline: jest.fn(),
    }

    OutlineCommand.mockImplementation(() => mockOutlineCommand)

    tool = new OutlineTool(mockUserContextProvider)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Zod API', () => {
    it('getName() returns expected name', () => {
      expect(tool.getName()).toBe('generate_outline')
    })

    it('getDescription() returns non-empty description', () => {
      expect(typeof tool.getDescription()).toBe('string')
      expect(tool.getDescription().length).toBeGreaterThan(20)
    })

    it('getZodShape() exposes all mode parameters', () => {
      const shape = tool.getZodShape()

      expect(shape.query).toBeDefined()
      expect(shape.web).toBeDefined()
      expect(shape.scholar).toBeDefined()
      expect(shape.ext).toBeDefined()
      expect(shape.context).toBeDefined()
      expect(shape.href).toBeDefined()
      expect(shape.minYear).toBeDefined()
      expect(shape.lang).toBeDefined()
      expect(shape.citations).toBeDefined()
      expect(shape.maxChunks).toBeDefined()
    })
  })

  describe('execute', () => {
    it('generates outline with web mode', async () => {
      mockOutlineCommand.createResponseOutline.mockResolvedValue('Test Outline')

      const result = await tool.execute({query: 'AI research', web: 's'})

      expect(OutlineCommand).toHaveBeenCalledWith('test-user-123', 'test-workflow-456', null)
      expect(mockOutlineCommand.createResponseOutline).toHaveBeenCalledWith(
        expect.objectContaining({command: expect.stringContaining('--max-chunks=')}),
        'AI research',
        expect.objectContaining({
          maxChunks: expect.any(Number),
          disableSearchScrape: false,
        }),
      )
      expect(result.content[0].text).toBe('Test Outline')
    })

    it('generates outline with scholar mode', async () => {
      mockOutlineCommand.createResponseOutline.mockResolvedValue('Scholar Outline')

      const result = await tool.execute({query: 'Quantum computing', scholar: 'm', minYear: 2020})

      expect(mockOutlineCommand.createResponseOutline).toHaveBeenCalledWith(
        expect.any(Object),
        'Quantum computing',
        expect.objectContaining({
          maxChunks: expect.any(Number),
          serpApiParams: expect.objectContaining({as_ylo: 2020}),
          disableSearchScrape: false,
        }),
      )
      expect(result.content[0].text).toBe('Scholar Outline')
    })

    it('generates outline with ext mode', async () => {
      mockOutlineCommand.createResponseOutline.mockResolvedValue('KB Outline')

      const result = await tool.execute({query: 'Machine learning', ext: true, context: 'ml-papers'})

      expect(mockOutlineCommand.createResponseOutline).toHaveBeenCalledWith(
        expect.objectContaining({command: '--context=ml-papers'}),
        'Machine learning',
        expect.objectContaining({
          disableSearchScrape: true,
          context: 'ml-papers',
        }),
      )
      expect(result.content[0].text).toBe('KB Outline')
    })

    it('includes citations when requested', async () => {
      mockOutlineCommand.createResponseOutline.mockResolvedValue('Outline\n\nCitations:\n  [1] Source')

      const result = await tool.execute({query: 'Climate change', web: 's', citations: true})

      expect(mockOutlineCommand.createResponseOutline).toHaveBeenCalledWith(
        expect.any(Object),
        'Climate change',
        expect.objectContaining({
          citations: true,
        }),
      )
      expect(result.content[0].text).toContain('Citations')
    })

    it('includes lang when provided', async () => {
      mockOutlineCommand.createResponseOutline.mockResolvedValue('Очерк')

      const result = await tool.execute({query: 'История', web: 's', lang: 'ru'})

      expect(mockOutlineCommand.createResponseOutline).toHaveBeenCalledWith(
        expect.objectContaining({
          command: expect.stringMatching(/--lang=ru.*--max-chunks=\d+/),
        }),
        'История',
        expect.objectContaining({
          lang: 'ru',
        }),
      )
      expect(result.content[0].text).toBe('Очерк')
    })

    it('includes href in params when provided', async () => {
      mockOutlineCommand.createResponseOutline.mockResolvedValue('URL Outline')

      await tool.execute({query: 'Topic', href: 'https://example.com'})

      expect(mockOutlineCommand.createResponseOutline).toHaveBeenCalledWith(
        null,
        'Topic',
        expect.objectContaining({
          from: ['https://example.com'],
        }),
      )
    })

    it('returns placeholder when outline is empty', async () => {
      mockOutlineCommand.createResponseOutline.mockResolvedValue('')

      const result = await tool.execute({query: 'Empty query', web: 's'})

      expect(result.content[0].text).toBe('(empty outline)')
    })

    it('handles errors gracefully', async () => {
      mockOutlineCommand.createResponseOutline.mockRejectedValue(new Error('LLM timeout'))

      const result = await tool.execute({query: 'Test', web: 's'})

      expect(result.content[0].text).toBe('Error: LLM timeout')
      expect(result.isError).toBe(true)
    })

    it('passes synthetic node for LLM routing when lang provided', async () => {
      mockOutlineCommand.createResponseOutline.mockResolvedValue('Output')

      await tool.execute({query: 'Test', web: 's', lang: 'en', citations: true})

      expect(mockOutlineCommand.createResponseOutline).toHaveBeenCalledWith(
        expect.objectContaining({
          command: expect.stringMatching(/--lang=en.*--citations.*--max-chunks=\d+/),
        }),
        'Test',
        expect.any(Object),
      )
    })

    it('builds synthetic node with maxChunks flag', async () => {
      mockOutlineCommand.createResponseOutline.mockResolvedValue('Output')

      await tool.execute({query: 'Test', web: 's'})

      expect(mockOutlineCommand.createResponseOutline).toHaveBeenCalledWith(
        expect.objectContaining({command: expect.stringContaining('--max-chunks=')}),
        'Test',
        expect.any(Object),
      )
    })
  })

  describe('Zod shape semantics', () => {
    it('getZodShape() returns ZodType values', () => {
      const shape = tool.getZodShape()

      Object.values(shape).forEach(value => {
        expect(typeof value.safeParse).toBe('function')
        expect(typeof value.parse).toBe('function')
      })
    })

    it('getZodShape() query field rejects missing value', () => {
      const shape = tool.getZodShape()
      const schema = z.object({query: shape.query})
      expect(schema.safeParse({}).success).toBe(false)
    })

    it('getZodShape() optional fields accept missing values', () => {
      const shape = tool.getZodShape()
      const optionalFields = Object.keys(shape).filter(f => f !== 'query')

      optionalFields.forEach(field => {
        const schema = z.object({[field]: shape[field]})
        expect(schema.safeParse({}).success).toBe(true)
      })
    })

    it('getZodShape returns consistent field set across multiple calls', () => {
      const shape1 = tool.getZodShape()
      const shape2 = tool.getZodShape()
      expect(Object.keys(shape1).sort()).toEqual(Object.keys(shape2).sort())
    })
  })
})

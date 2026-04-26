import {WebSearchQATool} from '../../tools/WebSearchQATool'
import {ScholarSearchQATool} from '../../tools/ScholarSearchQATool'
import {KnowledgeBaseQueryTool} from '../../tools/KnowledgeBaseQueryTool'
import {MemorizeContentTool} from '../../tools/MemorizeContentTool'
import {CommandContextAdapter} from '../../context/CommandContextAdapter'
import {WebCommand} from '../../../../controllers/commandExecutor/commands/WebCommand'
import {ScholarCommand} from '../../../../controllers/commandExecutor/commands/ScholarCommand'
import {ExtCommand} from '../../../../controllers/commandExecutor/commands/ExtCommand'
import {MemorizeCommand} from '../../../../controllers/commandExecutor/commands/MemorizeCommand'

jest.mock('../../../../controllers/commandExecutor/commands/WebCommand')
jest.mock('../../../../controllers/commandExecutor/commands/ScholarCommand')
jest.mock('../../../../controllers/commandExecutor/commands/ExtCommand')
jest.mock('../../../../controllers/commandExecutor/commands/MemorizeCommand')

describe('Delegation Integration Tests', () => {
  let mockUserContext
  let mockAdapter

  beforeEach(() => {
    jest.clearAllMocks()

    mockUserContext = {
      getUserId: jest.fn().mockReturnValue('test-user-id'),
      getIntegrationSettings: jest.fn(),
    }
    mockAdapter = new CommandContextAdapter()
  })

  describe('WebSearchQATool → WebCommand delegation', () => {
    it('delegates to WebCommand.createResponseWeb with synthetic node', async () => {
      const mockCreateResponse = jest.fn().mockResolvedValue('web search result')
      WebCommand.mockImplementation(() => ({
        createResponseWeb: mockCreateResponse,
      }))

      const tool = new WebSearchQATool(mockUserContext, mockAdapter)
      await tool.execute({query: 'test query', lang: 'ru'})

      expect(WebCommand).toHaveBeenCalledWith('test-user-id', null, null)
      expect(mockCreateResponse).toHaveBeenCalledWith(
        {command: '--lang=ru'},
        'test query',
        expect.objectContaining({lang: 'ru'}),
      )
    })

    it('passes null node when no lang parameter', async () => {
      const mockCreateResponse = jest.fn().mockResolvedValue('result')
      WebCommand.mockImplementation(() => ({
        createResponseWeb: mockCreateResponse,
      }))

      const tool = new WebSearchQATool(mockUserContext, mockAdapter)
      await tool.execute({query: 'test query'})

      expect(mockCreateResponse).toHaveBeenCalledWith(null, 'test query', expect.any(Object))
    })

    it('wraps command result in MCP content format', async () => {
      WebCommand.mockImplementation(() => ({
        createResponseWeb: jest.fn().mockResolvedValue('command result'),
      }))

      const tool = new WebSearchQATool(mockUserContext, mockAdapter)
      const result = await tool.execute({query: 'test'})

      expect(result).toEqual({
        content: [{type: 'text', text: 'command result'}],
      })
    })

    it('handles command returning empty string', async () => {
      WebCommand.mockImplementation(() => ({
        createResponseWeb: jest.fn().mockResolvedValue(''),
      }))

      const tool = new WebSearchQATool(mockUserContext, mockAdapter)
      const result = await tool.execute({query: 'test'})

      expect(result.content[0].text).toBe('(empty response)')
    })

    it('catches command errors and returns MCP error format', async () => {
      WebCommand.mockImplementation(() => ({
        createResponseWeb: jest.fn().mockRejectedValue(new Error('LLM timeout')),
      }))

      const tool = new WebSearchQATool(mockUserContext, mockAdapter)
      const result = await tool.execute({query: 'test'})

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error: LLM timeout')
    })
  })

  describe('ScholarSearchQATool → ScholarCommand delegation', () => {
    it('delegates with minYear parameter in synthetic node', async () => {
      const mockCreateResponse = jest.fn().mockResolvedValue('scholar result')
      ScholarCommand.mockImplementation(() => ({
        createResponseScholar: mockCreateResponse,
      }))

      const tool = new ScholarSearchQATool(mockUserContext, mockAdapter)
      await tool.execute({query: 'AI research', lang: 'en', minYear: 2020})

      expect(mockCreateResponse).toHaveBeenCalledWith(
        {command: '--lang=en --min-year=2020'},
        'AI research',
        expect.objectContaining({lang: 'en', minYear: 2020}),
      )
    })

    it('passes citations parameter through params', async () => {
      const mockCreateResponse = jest.fn().mockResolvedValue('result')
      ScholarCommand.mockImplementation(() => ({
        createResponseScholar: mockCreateResponse,
      }))

      const tool = new ScholarSearchQATool(mockUserContext, mockAdapter)
      await tool.execute({query: 'test', citations: true})

      expect(mockCreateResponse).toHaveBeenCalledWith(
        {command: '--citations'},
        'test',
        expect.objectContaining({citations: true}),
      )
    })
  })

  describe('KnowledgeBaseQueryTool → ExtCommand delegation', () => {
    it('delegates with context parameter', async () => {
      const mockCreateResponse = jest.fn().mockResolvedValue('kb result')
      ExtCommand.mockImplementation(() => ({
        createResponseExt: mockCreateResponse,
      }))

      const tool = new KnowledgeBaseQueryTool(mockUserContext, mockAdapter)
      await tool.execute({query: 'search kb', context: 'my-kb', lang: 'ru'})

      expect(mockCreateResponse).toHaveBeenCalledWith(
        {command: '--lang=ru --context=my-kb'},
        'search kb',
        expect.objectContaining({context: 'my-kb', lang: 'ru'}),
      )
    })
  })

  describe('MemorizeContentTool → MemorizeCommand delegation', () => {
    it('delegates to _getVectorStore with command string', async () => {
      const mockGetVectorStore = jest.fn().mockResolvedValue({})
      const mockCreateChunks = jest.fn().mockReturnValue([{content: 'chunk', hrefs: ['src']}])
      const mockSaveEmbeddings = jest.fn().mockResolvedValue()

      MemorizeCommand.mockImplementation(() => ({
        _getVectorStore: mockGetVectorStore,
        createChunks: mockCreateChunks,
        saveEmbeddings: mockSaveEmbeddings,
      }))

      const tool = new MemorizeContentTool(mockUserContext, mockAdapter)
      await tool.execute({text: 'content to memorize', context: 'my-context'})

      expect(mockGetVectorStore).toHaveBeenCalledWith('--context=my-context', 'my-context')
    })

    it('delegates chunking logic to MemorizeCommand.createChunks', async () => {
      const mockCreateChunks = jest.fn().mockReturnValue([
        {content: 'chunk1', hrefs: ['mcp-memorize']},
        {content: 'chunk2', hrefs: ['mcp-memorize']},
      ])

      MemorizeCommand.mockImplementation(() => ({
        _getVectorStore: jest.fn().mockResolvedValue({}),
        createChunks: mockCreateChunks,
        saveEmbeddings: jest.fn().mockResolvedValue(),
      }))

      const tool = new MemorizeContentTool(mockUserContext, mockAdapter)
      await tool.execute({text: 'text content', split: '\n\n'})

      expect(mockCreateChunks).toHaveBeenCalledWith('text content', 'mcp-memorize', '\n\n')
    })

    it('delegates save operation to MemorizeCommand.saveEmbeddings', async () => {
      const mockChunks = [{content: 'chunk', hrefs: ['mcp-memorize']}]
      const mockSaveEmbeddings = jest.fn().mockResolvedValue()

      MemorizeCommand.mockImplementation(() => ({
        _getVectorStore: jest.fn().mockResolvedValue({}),
        createChunks: jest.fn().mockReturnValue(mockChunks),
        saveEmbeddings: mockSaveEmbeddings,
      }))

      const tool = new MemorizeContentTool(mockUserContext, mockAdapter)
      await tool.execute({text: 'content', keep: false})

      expect(mockSaveEmbeddings).toHaveBeenCalledWith({}, mockChunks, false)
    })
  })

  describe('Cross-tool delegation consistency', () => {
    it('all query tools construct synthetic nodes consistently', async () => {
      const webMock = jest.fn().mockResolvedValue('web')
      const scholarMock = jest.fn().mockResolvedValue('scholar')
      const kbMock = jest.fn().mockResolvedValue('kb')

      WebCommand.mockImplementation(() => ({createResponseWeb: webMock}))
      ScholarCommand.mockImplementation(() => ({createResponseScholar: scholarMock}))
      ExtCommand.mockImplementation(() => ({createResponseExt: kbMock}))

      const params = {lang: 'ru', citations: true}
      const webTool = new WebSearchQATool(mockUserContext, mockAdapter)
      const scholarTool = new ScholarSearchQATool(mockUserContext, mockAdapter)
      const kbTool = new KnowledgeBaseQueryTool(mockUserContext, mockAdapter)

      await webTool.execute({query: 'q', ...params})
      await scholarTool.execute({query: 'q', ...params})
      await kbTool.execute({query: 'q', ...params})

      const webNode = webMock.mock.calls[0][0]
      const scholarNode = scholarMock.mock.calls[0][0]
      const kbNode = kbMock.mock.calls[0][0]

      expect(webNode).toEqual(scholarNode)
      expect(scholarNode).toEqual(kbNode)
      expect(webNode.command).toBe('--lang=ru --citations')
    })

    it('all tools use same userId from context', async () => {
      WebCommand.mockImplementation(() => ({createResponseWeb: jest.fn().mockResolvedValue('')}))
      ScholarCommand.mockImplementation(() => ({
        createResponseScholar: jest.fn().mockResolvedValue(''),
      }))
      ExtCommand.mockImplementation(() => ({createResponseExt: jest.fn().mockResolvedValue('')}))
      MemorizeCommand.mockImplementation(() => ({
        _getVectorStore: jest.fn().mockResolvedValue({}),
        createChunks: jest.fn().mockReturnValue([{content: 'c', hrefs: ['h']}]),
        saveEmbeddings: jest.fn().mockResolvedValue(),
      }))

      const webTool = new WebSearchQATool(mockUserContext, mockAdapter)
      const scholarTool = new ScholarSearchQATool(mockUserContext, mockAdapter)
      const kbTool = new KnowledgeBaseQueryTool(mockUserContext, mockAdapter)
      const memorizeTool = new MemorizeContentTool(mockUserContext, mockAdapter)

      await webTool.execute({query: 'q'})
      await scholarTool.execute({query: 'q'})
      await kbTool.execute({query: 'q'})
      await memorizeTool.execute({text: 't'})

      expect(WebCommand).toHaveBeenCalledWith('test-user-id', null, null)
      expect(ScholarCommand).toHaveBeenCalledWith('test-user-id', null, null)
      expect(ExtCommand).toHaveBeenCalledWith('test-user-id', null, null)
      expect(MemorizeCommand).toHaveBeenCalledWith('test-user-id', null, null)
    })

    it('all tools handle errors consistently with MCP error format', async () => {
      const error = new Error('Test error')
      WebCommand.mockImplementation(() => ({createResponseWeb: jest.fn().mockRejectedValue(error)}))
      ScholarCommand.mockImplementation(() => ({
        createResponseScholar: jest.fn().mockRejectedValue(error),
      }))
      ExtCommand.mockImplementation(() => ({createResponseExt: jest.fn().mockRejectedValue(error)}))
      MemorizeCommand.mockImplementation(() => ({
        _getVectorStore: jest.fn().mockRejectedValue(error),
      }))

      const webTool = new WebSearchQATool(mockUserContext, mockAdapter)
      const scholarTool = new ScholarSearchQATool(mockUserContext, mockAdapter)
      const kbTool = new KnowledgeBaseQueryTool(mockUserContext, mockAdapter)
      const memorizeTool = new MemorizeContentTool(mockUserContext, mockAdapter)

      const [webResult, scholarResult, kbResult, memorizeResult] = await Promise.all([
        webTool.execute({query: 'q'}),
        scholarTool.execute({query: 'q'}),
        kbTool.execute({query: 'q'}),
        memorizeTool.execute({text: 't'}),
      ])

      expect(webResult.isError).toBe(true)
      expect(scholarResult.isError).toBe(true)
      expect(kbResult.isError).toBe(true)
      expect(memorizeResult.isError).toBe(true)

      expect(webResult.content[0].text).toContain('Error: Test error')
      expect(scholarResult.content[0].text).toContain('Error: Test error')
      expect(kbResult.content[0].text).toContain('Error: Test error')
      expect(memorizeResult.content[0].text).toContain('Error: Test error')
    })
  })
})

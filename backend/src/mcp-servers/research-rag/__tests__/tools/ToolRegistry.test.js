import {ToolRegistry} from '../../tools/ToolRegistry'
import {WebSearchQATool} from '../../tools/WebSearchQATool'
import {ScholarSearchQATool} from '../../tools/ScholarSearchQATool'
import {KnowledgeBaseQueryTool} from '../../tools/KnowledgeBaseQueryTool'
import {MemorizeContentTool} from '../../tools/MemorizeContentTool'

describe('ToolRegistry', () => {
  let mockUserContext
  let mockAdapter
  let registry

  beforeEach(() => {
    mockUserContext = {
      getUserId: jest.fn(),
      getIntegrationSettings: jest.fn(),
    }
    mockAdapter = {
      parseWebSearchParams: jest.fn(),
      parseScholarSearchParams: jest.fn(),
      parseKnowledgeBaseParams: jest.fn(),
      parseMemorizeParams: jest.fn(),
    }
    registry = new ToolRegistry(mockUserContext, mockAdapter)
  })

  describe('constructor', () => {
    it('initializes with 4 tools', () => {
      expect(registry.tools).toHaveLength(4)
    })

    it('creates WebSearchQATool instance', () => {
      const webTool = registry.tools.find(t => t instanceof WebSearchQATool)
      expect(webTool).toBeDefined()
    })

    it('creates ScholarSearchQATool instance', () => {
      const scholarTool = registry.tools.find(t => t instanceof ScholarSearchQATool)
      expect(scholarTool).toBeDefined()
    })

    it('creates KnowledgeBaseQueryTool instance', () => {
      const kbTool = registry.tools.find(t => t instanceof KnowledgeBaseQueryTool)
      expect(kbTool).toBeDefined()
    })

    it('creates MemorizeContentTool instance', () => {
      const memorizeTool = registry.tools.find(t => t instanceof MemorizeContentTool)
      expect(memorizeTool).toBeDefined()
    })

    it('injects userContextProvider into all tools', () => {
      registry.tools.forEach(tool => {
        expect(tool.userContextProvider).toBe(mockUserContext)
      })
    })

    it('injects commandContextAdapter into all tools', () => {
      registry.tools.forEach(tool => {
        expect(tool.commandContextAdapter).toBe(mockAdapter)
      })
    })
  })

  describe('getAllTools', () => {
    it('returns all registered tools', () => {
      const tools = registry.getAllTools()

      expect(tools).toHaveLength(4)
      expect(tools).toBe(registry.tools)
    })

    it('returns tools in consistent order', () => {
      const tools1 = registry.getAllTools()
      const tools2 = registry.getAllTools()

      expect(tools1).toEqual(tools2)
    })

    it('returned array contains tool instances with getSchema method', () => {
      const tools = registry.getAllTools()

      tools.forEach(tool => {
        expect(typeof tool.getSchema).toBe('function')
      })
    })

    it('returned array contains tool instances with execute method', () => {
      const tools = registry.getAllTools()

      tools.forEach(tool => {
        expect(typeof tool.execute).toBe('function')
      })
    })
  })

  describe('registerAll', () => {
    let mockMcpServer

    beforeEach(() => {
      mockMcpServer = {
        registerTool: jest.fn(),
      }
    })

    it('registers all 4 tools with MCP server', () => {
      registry.registerAll(mockMcpServer)

      expect(mockMcpServer.registerTool).toHaveBeenCalledTimes(4)
    })

    it('registers web_search_qa tool', () => {
      registry.registerAll(mockMcpServer)

      const call = mockMcpServer.registerTool.mock.calls.find(c => c[0] === 'web_search_qa')
      expect(call).toBeDefined()
    })

    it('registers scholar_search_qa tool', () => {
      registry.registerAll(mockMcpServer)

      const call = mockMcpServer.registerTool.mock.calls.find(c => c[0] === 'scholar_search_qa')
      expect(call).toBeDefined()
    })

    it('registers kb_query tool', () => {
      registry.registerAll(mockMcpServer)

      const call = mockMcpServer.registerTool.mock.calls.find(c => c[0] === 'kb_query')
      expect(call).toBeDefined()
    })

    it('registers memorize_content tool', () => {
      registry.registerAll(mockMcpServer)

      const call = mockMcpServer.registerTool.mock.calls.find(c => c[0] === 'memorize_content')
      expect(call).toBeDefined()
    })

    it('passes tool schema as second argument', () => {
      registry.registerAll(mockMcpServer)

      mockMcpServer.registerTool.mock.calls.forEach(call => {
        const schema = call[1]
        expect(schema).toHaveProperty('name')
        expect(schema).toHaveProperty('description')
        expect(schema).toHaveProperty('inputSchema')
      })
    })

    it('passes execute handler as third argument', () => {
      registry.registerAll(mockMcpServer)

      mockMcpServer.registerTool.mock.calls.forEach(call => {
        const handler = call[2]
        expect(typeof handler).toBe('function')
      })
    })

    it('execute handler calls tool.execute with args', async () => {
      registry.registerAll(mockMcpServer)

      const webSearchCall = mockMcpServer.registerTool.mock.calls.find(c => c[0] === 'web_search_qa')
      const handler = webSearchCall[2]

      const webTool = registry.tools.find(t => t instanceof WebSearchQATool)
      webTool.execute = jest.fn().mockResolvedValue({content: [{type: 'text', text: 'result'}]})

      const testArgs = {query: 'test query'}
      await handler(testArgs)

      expect(webTool.execute).toHaveBeenCalledWith(testArgs)
    })

    it('can be called multiple times without errors', () => {
      registry.registerAll(mockMcpServer)
      registry.registerAll(mockMcpServer)

      expect(mockMcpServer.registerTool).toHaveBeenCalledTimes(8)
    })

    it('preserves tool registration order', () => {
      registry.registerAll(mockMcpServer)

      const names = mockMcpServer.registerTool.mock.calls.map(call => call[0])
      expect(names).toEqual(['web_search_qa', 'scholar_search_qa', 'kb_query', 'memorize_content'])
    })
  })

  describe('tool isolation', () => {
    it('tools do not share state', () => {
      const tools = registry.getAllTools()

      expect(tools[0]).not.toBe(tools[1])
      expect(tools[1]).not.toBe(tools[2])
      expect(tools[2]).not.toBe(tools[3])
    })

    it('modifying one tool does not affect others', () => {
      const tools = registry.getAllTools()
      tools[0].customProperty = 'test'

      expect(tools[1].customProperty).toBeUndefined()
      expect(tools[2].customProperty).toBeUndefined()
      expect(tools[3].customProperty).toBeUndefined()
    })
  })
})

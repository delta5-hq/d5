import {ToolRegistry} from '../../tools/ToolRegistry'

describe('ToolRegistry', () => {
  let registry
  let mockUserContextProvider

  beforeEach(() => {
    mockUserContextProvider = {
      getUserId: jest.fn().mockReturnValue('test-user-123'),
    }
    registry = new ToolRegistry(mockUserContextProvider)
  })

  describe('constructor', () => {
    it('initializes with OutlineTool', () => {
      const tools = registry.getAllTools()

      expect(tools).toHaveLength(1)
      expect(tools[0].getName()).toBe('generate_outline')
    })

    it('passes userContextProvider to OutlineTool', () => {
      const tools = registry.getAllTools()

      expect(tools[0].userContextProvider).toBe(mockUserContextProvider)
    })
  })

  describe('registerAll', () => {
    it('registers all tools with MCP server', () => {
      const mockServer = {
        tool: jest.fn(),
      }

      registry.registerAll(mockServer)

      expect(mockServer.tool).toHaveBeenCalledTimes(1)
      expect(mockServer.tool).toHaveBeenCalledWith(
        'generate_outline',
        expect.any(String),
        expect.any(Object),
        expect.any(Function),
      )
    })

    it('registered handler delegates to tool execute', async () => {
      const mockServer = {
        tool: jest.fn(),
      }

      registry.registerAll(mockServer)

      const handler = mockServer.tool.mock.calls[0][3]
      const mockArgs = {query: 'Test', web: 's'}

      const executeSpy = jest.spyOn(registry.tools[0], 'execute').mockResolvedValue({content: []})

      await handler(mockArgs)

      expect(executeSpy).toHaveBeenCalledWith(mockArgs)
    })
  })

  describe('getAllTools', () => {
    it('returns array of tool instances', () => {
      const tools = registry.getAllTools()

      expect(Array.isArray(tools)).toBe(true)
      expect(tools.length).toBeGreaterThan(0)
    })

    it('returned tools have execute method', () => {
      const tools = registry.getAllTools()

      tools.forEach(tool => {
        expect(typeof tool.execute).toBe('function')
      })
    })
  })
})

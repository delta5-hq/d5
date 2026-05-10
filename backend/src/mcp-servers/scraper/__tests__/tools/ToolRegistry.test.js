import {ToolRegistry} from '../../tools/ToolRegistry'

describe('ToolRegistry', () => {
  let registry

  beforeEach(() => {
    registry = new ToolRegistry()
  })

  describe('constructor', () => {
    it('initializes with ScrapeTool', () => {
      const tools = registry.getAllTools()

      expect(tools).toHaveLength(1)
      expect(tools[0].getName()).toBe('scrape_web_pages')
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
        'scrape_web_pages',
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
      const mockArgs = {urls: ['https://example.com']}

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

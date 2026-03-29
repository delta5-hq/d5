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
      expect(tools[0].getSchema().name).toBe('scrape_web_pages')
    })
  })

  describe('registerAll', () => {
    it('registers all tools with MCP server', () => {
      const mockServer = {
        registerTool: jest.fn(),
      }

      registry.registerAll(mockServer)

      expect(mockServer.registerTool).toHaveBeenCalledTimes(1)
      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'scrape_web_pages',
        expect.objectContaining({
          name: 'scrape_web_pages',
          description: expect.any(String),
        }),
        expect.any(Function),
      )
    })

    it('registered handler delegates to tool execute', async () => {
      const mockServer = {
        registerTool: jest.fn(),
      }

      registry.registerAll(mockServer)

      const handler = mockServer.registerTool.mock.calls[0][2]
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

    it('returned tools have getSchema method', () => {
      const tools = registry.getAllTools()

      tools.forEach(tool => {
        expect(typeof tool.getSchema).toBe('function')
      })
    })

    it('returned tools have execute method', () => {
      const tools = registry.getAllTools()

      tools.forEach(tool => {
        expect(typeof tool.execute).toBe('function')
      })
    })
  })
})

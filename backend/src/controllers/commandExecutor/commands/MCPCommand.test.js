import {MCPCommand} from './MCPCommand'
import Store from './utils/Store'
import * as MCPClientManager from './mcp/MCPClientManager'

/* Manual mock factory — auto-mock triggers zod ESM crash in Jest 27 */
jest.mock('./mcp/MCPClientManager', () => ({
  callTool: jest.fn(),
  listTools: jest.fn(),
}))

describe('MCPCommand', () => {
  const userId = 'userId'
  const workflowId = 'workflowId'
  const aliasConfig = {
    alias: '/coder1',
    serverUrl: 'http://localhost:3100',
    transport: 'streamable-http',
    toolName: 'run_vm',
    description: 'Test coder',
  }
  const mockStore = new Store({
    userId,
    workflowId,
    nodes: {},
  })
  const command = new MCPCommand(userId, workflowId, mockStore, aliasConfig)

  beforeEach(() => {
    jest.clearAllMocks()
    mockStore.importer.createNodes = jest.fn()
    MCPClientManager.callTool.mockResolvedValue({isError: false, content: 'MCP result text'})
  })

  describe('run', () => {
    const node = {id: 'node', command: '/coder1 write tests'}

    it('should call callTool with aliasConfig fields and stripped prompt', async () => {
      await command.run(node, undefined, '/coder1 write tests')

      expect(MCPClientManager.callTool).toHaveBeenCalledWith({
        serverUrl: 'http://localhost:3100',
        transport: 'streamable-http',
        toolName: 'run_vm',
        toolArguments: {prompt: 'write tests'},
      })
    })

    it('should create nodes from tool response content', async () => {
      await command.run(node, undefined, '/coder1 test')

      expect(mockStore.importer.createNodes).toHaveBeenCalledWith('MCP result text', 'node')
    })

    it('should prepend context to prompt when provided', async () => {
      await command.run(node, 'Context:\nprevious result\n', '/coder1 hello')

      expect(MCPClientManager.callTool).toHaveBeenCalledWith(
        expect.objectContaining({
          toolArguments: {prompt: 'Context:\nprevious result\nhello'},
        }),
      )
    })

    it.each([
      ['empty string', ''],
      ['null', null],
      ['undefined', undefined],
    ])('should send raw prompt when context is %s', async (_label, context) => {
      await command.run(node, context, '/coder1 hello')

      expect(MCPClientManager.callTool).toHaveBeenCalledWith(
        expect.objectContaining({
          toolArguments: {prompt: 'hello'},
        }),
      )
    })

    it('should preserve multiline prompt after alias stripping', async () => {
      await command.run(node, undefined, '/coder1 line1\nline2\nline3')

      expect(MCPClientManager.callTool).toHaveBeenCalledWith(
        expect.objectContaining({
          toolArguments: {prompt: 'line1\nline2\nline3'},
        }),
      )
    })

    it('should create nodes with isError content when tool reports error', async () => {
      MCPClientManager.callTool.mockResolvedValue({isError: true, content: 'tool error detail'})

      await command.run(node, undefined, '/coder1 test')

      expect(mockStore.importer.createNodes).toHaveBeenCalledWith('tool error detail', 'node')
    })

    it('should create error node when callTool throws', async () => {
      MCPClientManager.callTool.mockRejectedValue(new Error('connection refused'))

      await command.run(node, undefined, '/coder1 test')

      expect(mockStore.importer.createNodes).toHaveBeenCalledWith('Error: connection refused', 'node')
    })

    it.each([
      ['empty string', ''],
      ['null', null],
      ['undefined', undefined],
    ])('should create fallback node when content is %s', async (_label, content) => {
      MCPClientManager.callTool.mockResolvedValue({isError: false, content})

      await command.run(node, undefined, '/coder1 test')

      expect(mockStore.importer.createNodes).toHaveBeenCalledWith('(empty MCP response)', 'node')
    })
    it('should pass headers from aliasConfig to callTool', async () => {
      const headersConfig = {...aliasConfig, headers: {Authorization: 'Bearer tok'}}
      const cmd = new MCPCommand(userId, workflowId, mockStore, headersConfig)

      await cmd.run(node, undefined, '/coder1 test')

      expect(MCPClientManager.callTool).toHaveBeenCalledWith(
        expect.objectContaining({headers: {Authorization: 'Bearer tok'}}),
      )
    })

    it('should use custom toolInputField in callTool arguments', async () => {
      const customConfig = {...aliasConfig, toolInputField: 'query'}
      const cmd = new MCPCommand(userId, workflowId, mockStore, customConfig)

      await cmd.run(node, undefined, '/coder1 search term')

      expect(MCPClientManager.callTool).toHaveBeenCalledWith(
        expect.objectContaining({toolArguments: {query: 'search term'}}),
      )
    })

    it('should merge toolStaticArgs into callTool arguments', async () => {
      const customConfig = {...aliasConfig, toolStaticArgs: {lang: 'en'}}
      const cmd = new MCPCommand(userId, workflowId, mockStore, customConfig)

      await cmd.run(node, undefined, '/coder1 hello')

      expect(MCPClientManager.callTool).toHaveBeenCalledWith(
        expect.objectContaining({toolArguments: {prompt: 'hello', lang: 'en'}}),
      )
    })
  })

  describe('buildToolArguments', () => {
    it('should default inputField to "prompt"', () => {
      expect(command.buildToolArguments('hello')).toEqual({prompt: 'hello'})
    })

    it('should use custom toolInputField', () => {
      const cmd = new MCPCommand(userId, workflowId, mockStore, {...aliasConfig, toolInputField: 'query'})
      expect(cmd.buildToolArguments('hello')).toEqual({query: 'hello'})
    })

    it('should merge toolStaticArgs with dynamic input', () => {
      const cmd = new MCPCommand(userId, workflowId, mockStore, {
        ...aliasConfig,
        toolStaticArgs: {format: 'json', verbose: true},
      })
      expect(cmd.buildToolArguments('hello')).toEqual({prompt: 'hello', format: 'json', verbose: true})
    })

    it('should let dynamic input override colliding static arg', () => {
      const cmd = new MCPCommand(userId, workflowId, mockStore, {
        ...aliasConfig,
        toolStaticArgs: {prompt: 'should-be-overridden'},
      })
      expect(cmd.buildToolArguments('actual')).toEqual({prompt: 'actual'})
    })

    it('should combine custom toolInputField with toolStaticArgs', () => {
      const cmd = new MCPCommand(userId, workflowId, mockStore, {
        ...aliasConfig,
        toolInputField: 'query',
        toolStaticArgs: {format: 'markdown'},
      })
      expect(cmd.buildToolArguments('search term')).toEqual({query: 'search term', format: 'markdown'})
    })

    it('should treat empty string toolInputField as falsy and default to prompt', () => {
      const cmd = new MCPCommand(userId, workflowId, mockStore, {...aliasConfig, toolInputField: ''})
      expect(cmd.buildToolArguments('hello')).toEqual({prompt: 'hello'})
    })

    it('should handle empty toolStaticArgs object', () => {
      const cmd = new MCPCommand(userId, workflowId, mockStore, {...aliasConfig, toolStaticArgs: {}})
      expect(cmd.buildToolArguments('hello')).toEqual({prompt: 'hello'})
    })

    it('should handle undefined toolStaticArgs gracefully', () => {
      expect(command.buildToolArguments('test')).toEqual({prompt: 'test'})
    })
  })

  describe('extractPrompt', () => {
    it('should prefer originalPrompt over node fields', () => {
      expect(command.extractPrompt({command: '/coder1 from-node'}, '/coder1 from-original')).toBe('from-original')
    })

    it('should fall back to node.command when originalPrompt is undefined', () => {
      expect(command.extractPrompt({command: '/coder1 from-node', title: '/coder1 from-title'}, undefined)).toBe(
        'from-node',
      )
    })

    it('should fall back to node.title when node.command is absent', () => {
      expect(command.extractPrompt({title: '/coder1 from-title'}, undefined)).toBe('from-title')
    })

    it('should return empty string when node has neither command nor title', () => {
      expect(command.extractPrompt({id: 'node'}, undefined)).toBe('')
    })

    it('should return empty string when node is null', () => {
      expect(command.extractPrompt(null, undefined)).toBe('')
    })

    it('should use node.command when originalPrompt is empty string', () => {
      expect(command.extractPrompt({command: '/coder1 fallback'}, '')).toBe('fallback')
    })
  })

  describe('stripAliasPrefix', () => {
    it('should remove alias prefix and return trailing content', () => {
      expect(command.stripAliasPrefix('/coder1 do something')).toBe('do something')
    })

    it('should handle leading whitespace before alias', () => {
      expect(command.stripAliasPrefix('  /coder1 task')).toBe('task')
    })

    it('should return trimmed text when alias is not present', () => {
      expect(command.stripAliasPrefix('  plain text  ')).toBe('plain text  ')
    })

    it('should return empty string when text is only the alias', () => {
      expect(command.stripAliasPrefix('/coder1')).toBe('')
    })

    it('should return empty string for empty input', () => {
      expect(command.stripAliasPrefix('')).toBe('')
    })

    it('should not strip partial alias match (superset)', () => {
      expect(command.stripAliasPrefix('/coder10 extra')).toBe('/coder10 extra')
    })

    it('should be case-sensitive', () => {
      expect(command.stripAliasPrefix('/Coder1 test')).toBe('/Coder1 test')
    })

    it('should strip alias with multiple spaces after prefix', () => {
      expect(command.stripAliasPrefix('/coder1   spaced')).toBe('spaced')
    })

    it('should strip alias followed by tab', () => {
      expect(command.stripAliasPrefix('/coder1\ttabbed')).toBe('tabbed')
    })
  })
})

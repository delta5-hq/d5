import {ToolInvoker} from '../ToolInvoker'
import {callTool} from '../../../controllers/commandExecutor/commands/mcp/MCPClientManager'
import {MCP_TRANSPORT, MCP_DEFAULT_TIMEOUT_MS} from '../../../controllers/commandExecutor/constants/mcp'

jest.mock('../../../controllers/commandExecutor/commands/mcp/MCPClientManager')

describe('ToolInvoker', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('invoke', () => {
    it('delegates to callTool with stdio transport', async () => {
      callTool.mockResolvedValue({isError: false, content: 'result'})

      const invoker = new ToolInvoker()
      await invoker.invoke({
        serverPath: './server.js',
        toolName: 'test_tool',
        toolArguments: {arg: 'value'},
        env: {VAR: 'value'},
      })

      expect(callTool).toHaveBeenCalledWith({
        transport: MCP_TRANSPORT.STDIO,
        command: 'npx',
        args: ['babel-node', './server.js'],
        env: {VAR: 'value'},
        toolName: 'test_tool',
        toolArguments: {arg: 'value'},
        timeoutMs: MCP_DEFAULT_TIMEOUT_MS,
      })
    })

    it('uses npx babel-node for server execution', async () => {
      callTool.mockResolvedValue({isError: false, content: 'result'})

      const invoker = new ToolInvoker()
      await invoker.invoke({
        serverPath: './outliner/server.js',
        toolName: 'generate_outline',
        toolArguments: {},
        env: {},
      })

      const callArgs = callTool.mock.calls[0][0]
      expect(callArgs.command).toBe('npx')
      expect(callArgs.args).toEqual(['babel-node', './outliner/server.js'])
    })

    it('forwards environment variables to child process', async () => {
      callTool.mockResolvedValue({isError: false, content: 'result'})

      const env = {
        D5_USER_ID: 'user123',
        MONGO_URI: 'mongodb://localhost',
        OPENAI_API_KEY: 'sk-test',
      }

      const invoker = new ToolInvoker()
      await invoker.invoke({
        serverPath: './server.js',
        toolName: 'tool',
        toolArguments: {},
        env,
      })

      const callArgs = callTool.mock.calls[0][0]
      expect(callArgs.env).toEqual(env)
    })

    it('uses default timeout when not specified', async () => {
      callTool.mockResolvedValue({isError: false, content: 'result'})

      const invoker = new ToolInvoker()
      await invoker.invoke({
        serverPath: './server.js',
        toolName: 'tool',
        toolArguments: {},
        env: {},
      })

      const callArgs = callTool.mock.calls[0][0]
      expect(callArgs.timeoutMs).toBe(MCP_DEFAULT_TIMEOUT_MS)
    })

    it('allows custom timeout via constructor', async () => {
      callTool.mockResolvedValue({isError: false, content: 'result'})

      const customTimeout = 60000
      const invoker = new ToolInvoker(customTimeout)
      await invoker.invoke({
        serverPath: './server.js',
        toolName: 'tool',
        toolArguments: {},
        env: {},
      })

      const callArgs = callTool.mock.calls[0][0]
      expect(callArgs.timeoutMs).toBe(customTimeout)
    })

    it('returns result from callTool', async () => {
      const expectedResult = {isError: false, content: 'success output'}
      callTool.mockResolvedValue(expectedResult)

      const invoker = new ToolInvoker()
      const result = await invoker.invoke({
        serverPath: './server.js',
        toolName: 'tool',
        toolArguments: {},
        env: {},
      })

      expect(result).toEqual(expectedResult)
    })

    it('propagates callTool errors', async () => {
      const error = new Error('MCP connection failed')
      callTool.mockRejectedValue(error)

      const invoker = new ToolInvoker()

      await expect(
        invoker.invoke({
          serverPath: './server.js',
          toolName: 'tool',
          toolArguments: {},
          env: {},
        }),
      ).rejects.toThrow('MCP connection failed')
    })
  })

  describe('environment edge cases', () => {
    it('handles empty environment object', async () => {
      callTool.mockResolvedValue({isError: false, content: 'result'})

      const invoker = new ToolInvoker()
      await invoker.invoke({
        serverPath: './server.js',
        toolName: 'tool',
        toolArguments: {},
        env: {},
      })

      const callArgs = callTool.mock.calls[0][0]
      expect(callArgs.env).toEqual({})
    })

    it('handles null environment gracefully', async () => {
      callTool.mockResolvedValue({isError: false, content: 'result'})

      const invoker = new ToolInvoker()
      await invoker.invoke({
        serverPath: './server.js',
        toolName: 'tool',
        toolArguments: {},
        env: null,
      })

      const callArgs = callTool.mock.calls[0][0]
      expect(callArgs.env).toBeNull()
    })

    it('preserves special environment variables', async () => {
      callTool.mockResolvedValue({isError: false, content: 'result'})

      const specialEnv = {
        PATH: '/usr/bin:/bin',
        HOME: '/home/user',
        NODE_ENV: 'production',
        D5_USER_ID: 'user123',
        MONGO_URI: 'mongodb://localhost',
      }

      const invoker = new ToolInvoker()
      await invoker.invoke({
        serverPath: './server.js',
        toolName: 'tool',
        toolArguments: {},
        env: specialEnv,
      })

      const callArgs = callTool.mock.calls[0][0]
      expect(callArgs.env).toEqual(specialEnv)
    })
  })

  describe('timeout edge cases', () => {
    it('handles zero timeout', async () => {
      callTool.mockResolvedValue({isError: false, content: 'result'})

      const invoker = new ToolInvoker(0)
      await invoker.invoke({
        serverPath: './server.js',
        toolName: 'tool',
        toolArguments: {},
        env: {},
      })

      const callArgs = callTool.mock.calls[0][0]
      expect(callArgs.timeoutMs).toBe(0)
    })

    it('handles very large timeout', async () => {
      callTool.mockResolvedValue({isError: false, content: 'result'})

      const invoker = new ToolInvoker(Number.MAX_SAFE_INTEGER)
      await invoker.invoke({
        serverPath: './server.js',
        toolName: 'tool',
        toolArguments: {},
        env: {},
      })

      const callArgs = callTool.mock.calls[0][0]
      expect(callArgs.timeoutMs).toBe(Number.MAX_SAFE_INTEGER)
    })

    it('handles negative timeout as-is', async () => {
      callTool.mockResolvedValue({isError: false, content: 'result'})

      const invoker = new ToolInvoker(-1000)
      await invoker.invoke({
        serverPath: './server.js',
        toolName: 'tool',
        toolArguments: {},
        env: {},
      })

      const callArgs = callTool.mock.calls[0][0]
      expect(callArgs.timeoutMs).toBe(-1000)
    })
  })

  describe('tool arguments complexity', () => {
    it('handles nested tool arguments', async () => {
      callTool.mockResolvedValue({isError: false, content: 'result'})

      const complexArgs = {
        simple: 'value',
        nested: {config: {deep: true}},
        array: [1, 2, 3],
      }

      const invoker = new ToolInvoker()
      await invoker.invoke({
        serverPath: './server.js',
        toolName: 'tool',
        toolArguments: complexArgs,
        env: {},
      })

      const callArgs = callTool.mock.calls[0][0]
      expect(callArgs.toolArguments).toEqual(complexArgs)
    })

    it('handles empty tool arguments object', async () => {
      callTool.mockResolvedValue({isError: false, content: 'result'})

      const invoker = new ToolInvoker()
      await invoker.invoke({
        serverPath: './server.js',
        toolName: 'tool',
        toolArguments: {},
        env: {},
      })

      const callArgs = callTool.mock.calls[0][0]
      expect(callArgs.toolArguments).toEqual({})
    })

    it('preserves tool argument types', async () => {
      callTool.mockResolvedValue({isError: false, content: 'result'})

      const typedArgs = {
        string: 'text',
        number: 42,
        boolean: true,
        null: null,
        array: ['a', 'b'],
        object: {key: 'value'},
      }

      const invoker = new ToolInvoker()
      await invoker.invoke({
        serverPath: './server.js',
        toolName: 'tool',
        toolArguments: typedArgs,
        env: {},
      })

      const callArgs = callTool.mock.calls[0][0]
      expect(callArgs.toolArguments).toEqual(typedArgs)
    })
  })
})

import {MCPCommand} from './MCPCommand'
import Store from './utils/Store'
import * as MCPClientManager from './mcp/MCPClientManager'
import * as getLLMModule from './utils/langchain/getLLM'
import * as getAgentExecutorModule from './utils/langchain/getAgentExecutor'
import {MCPToolAdapter} from './mcp/MCPToolAdapter'

/* Manual mock factory — auto-mock triggers zod ESM crash in Jest 27 */
jest.mock('./mcp/MCPClientManager', () => ({
  callTool: jest.fn(),
  listTools: jest.fn(),
  withClient: jest.fn(),
  formatToolResult: jest.fn(),
}))

jest.mock('./utils/langchain/getLLM', () => ({
  getIntegrationSettings: jest.fn(),
  determineLLMType: jest.fn().mockReturnValue('OpenAI'),
  getLLM: jest.fn().mockReturnValue({llm: {}, chunkSize: 4096}),
}))

jest.mock('./utils/langchain/getAgentExecutor', () => ({
  createSimpleAgentExecutor: jest.fn(),
}))

jest.mock('./mcp/MCPToolAdapter', () => ({
  MCPToolAdapter: jest.fn().mockImplementation(({toolDescriptor}) => ({name: toolDescriptor.name})),
}))

const userId = 'userId'
const workflowId = 'workflowId'

const makeStore = () =>
  new Store({
    userId,
    workflowId,
    nodes: {},
  })

const httpAliasConfig = {
  alias: '/coder1',
  serverUrl: 'http://localhost:3100',
  transport: 'streamable-http',
  toolName: 'run_vm',
  description: 'Test coder',
}

const stdioAliasConfig = {
  alias: '/coder1',
  transport: 'stdio',
  toolName: 'run',
  command: 'claude',
  args: ['mcp', 'serve'],
  env: {API_KEY: 'x'},
}

const mockToolDescriptors = [
  {name: 'read_file', description: 'read a file', inputSchema: {type: 'object', properties: {path: {type: 'string'}}}},
  {
    name: 'write_file',
    description: 'write a file',
    inputSchema: {type: 'object', properties: {path: {type: 'string'}, content: {type: 'string'}}},
  },
]

describe('MCPCommand', () => {
  let mockStore

  beforeEach(() => {
    jest.clearAllMocks()
    mockStore = makeStore()
    mockStore.importer.createNodes = jest.fn()
    MCPClientManager.callTool.mockResolvedValue({isError: false, content: 'MCP result text'})
    getLLMModule.getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'key'}})
  })

  const setupAgentMocks = agentOutput => {
    const mockClient = {listTools: jest.fn().mockResolvedValue({tools: mockToolDescriptors})}
    MCPClientManager.withClient.mockImplementation(async (_config, fn) => fn(mockClient))
    const executor = {call: jest.fn().mockResolvedValue({output: agentOutput})}
    getAgentExecutorModule.createSimpleAgentExecutor.mockReturnValue(executor)
    return {mockClient, executor}
  }

  describe('transportConfig', () => {
    it.each([
      [
        'streamable-http — includes serverUrl and headers, no stdio fields',
        {...httpAliasConfig, headers: {Auth: 'tok'}},
        {
          transport: 'streamable-http',
          serverUrl: 'http://localhost:3100',
          headers: {Auth: 'tok'},
          command: undefined,
          args: undefined,
          env: undefined,
        },
      ],
      [
        'stdio — includes command/args/env, no serverUrl',
        stdioAliasConfig,
        {
          transport: 'stdio',
          command: 'claude',
          args: ['mcp', 'serve'],
          env: {API_KEY: 'x'},
          serverUrl: undefined,
          headers: undefined,
        },
      ],
    ])('%s', (_label, aliasConfig, expected) => {
      const cmd = new MCPCommand(userId, workflowId, mockStore, aliasConfig)
      expect(cmd.transportConfig()).toEqual(expected)
    })
  })

  describe('run — direct mode (toolName !== "auto")', () => {
    const node = {id: 'node', command: '/coder1 write tests'}

    it('routes to callTool, not withClient', async () => {
      const cmd = new MCPCommand(userId, workflowId, mockStore, httpAliasConfig)
      await cmd.run(node, undefined, '/coder1 test')

      expect(MCPClientManager.callTool).toHaveBeenCalledTimes(1)
      expect(MCPClientManager.withClient).not.toHaveBeenCalled()
    })

    it('passes all transport config fields from aliasConfig to callTool', async () => {
      const cmd = new MCPCommand(userId, workflowId, mockStore, httpAliasConfig)
      await cmd.run(node, undefined, '/coder1 write tests')

      expect(MCPClientManager.callTool).toHaveBeenCalledWith(
        expect.objectContaining({
          serverUrl: 'http://localhost:3100',
          transport: 'streamable-http',
          toolName: 'run_vm',
        }),
      )
    })

    it('passes stdio transport fields to callTool', async () => {
      const cmd = new MCPCommand(userId, workflowId, mockStore, stdioAliasConfig)
      await cmd.run(node, undefined, '/coder1 test')

      expect(MCPClientManager.callTool).toHaveBeenCalledWith(
        expect.objectContaining({transport: 'stdio', command: 'claude', args: ['mcp', 'serve'], env: {API_KEY: 'x'}}),
      )
    })

    it('passes timeoutMs from aliasConfig to callTool', async () => {
      const cmd = new MCPCommand(userId, workflowId, mockStore, {...httpAliasConfig, timeoutMs: 300_000})
      await cmd.run(node, undefined, '/coder1 test')

      expect(MCPClientManager.callTool).toHaveBeenCalledWith(expect.objectContaining({timeoutMs: 300_000}))
    })

    describe('prompt assembly', () => {
      it('strips alias prefix and passes remaining text as the input field', async () => {
        const cmd = new MCPCommand(userId, workflowId, mockStore, httpAliasConfig)
        await cmd.run(node, undefined, '/coder1 write tests')

        expect(MCPClientManager.callTool).toHaveBeenCalledWith(
          expect.objectContaining({toolArguments: {prompt: 'write tests'}}),
        )
      })

      it('prepends context to the stripped prompt', async () => {
        const cmd = new MCPCommand(userId, workflowId, mockStore, httpAliasConfig)
        await cmd.run(node, 'ctx\n', '/coder1 hello')

        expect(MCPClientManager.callTool).toHaveBeenCalledWith(
          expect.objectContaining({toolArguments: {prompt: 'ctx\nhello'}}),
        )
      })

      it.each([
        ['empty string', ''],
        ['null', null],
        ['undefined', undefined],
      ])('omits context when it is %s', async (_label, context) => {
        const cmd = new MCPCommand(userId, workflowId, mockStore, httpAliasConfig)
        await cmd.run(node, context, '/coder1 hello')

        expect(MCPClientManager.callTool).toHaveBeenCalledWith(
          expect.objectContaining({toolArguments: {prompt: 'hello'}}),
        )
      })

      it('preserves multiline content in the prompt', async () => {
        const cmd = new MCPCommand(userId, workflowId, mockStore, httpAliasConfig)
        await cmd.run(node, undefined, '/coder1 line1\nline2\nline3')

        expect(MCPClientManager.callTool).toHaveBeenCalledWith(
          expect.objectContaining({toolArguments: {prompt: 'line1\nline2\nline3'}}),
        )
      })
    })

    describe('toolArguments mapping', () => {
      it('uses custom toolInputField as the argument key', async () => {
        const cmd = new MCPCommand(userId, workflowId, mockStore, {...httpAliasConfig, toolInputField: 'query'})
        await cmd.run(node, undefined, '/coder1 search term')

        expect(MCPClientManager.callTool).toHaveBeenCalledWith(
          expect.objectContaining({toolArguments: {query: 'search term'}}),
        )
      })

      it('merges toolStaticArgs with the dynamic prompt field', async () => {
        const cmd = new MCPCommand(userId, workflowId, mockStore, {...httpAliasConfig, toolStaticArgs: {lang: 'en'}})
        await cmd.run(node, undefined, '/coder1 hello')

        expect(MCPClientManager.callTool).toHaveBeenCalledWith(
          expect.objectContaining({toolArguments: {prompt: 'hello', lang: 'en'}}),
        )
      })
    })

    describe('result → node output', () => {
      it('creates a node with the content returned by the tool', async () => {
        const cmd = new MCPCommand(userId, workflowId, mockStore, httpAliasConfig)
        await cmd.run(node, undefined, '/coder1 test')

        expect(mockStore.importer.createNodes).toHaveBeenCalledWith('MCP result text', 'node')
      })

      it.each([
        ['empty string', ''],
        ['null', null],
        ['undefined', undefined],
      ])('creates fallback node when content is %s', async (_label, content) => {
        MCPClientManager.callTool.mockResolvedValue({isError: false, content})
        const cmd = new MCPCommand(userId, workflowId, mockStore, httpAliasConfig)
        await cmd.run(node, undefined, '/coder1 test')

        expect(mockStore.importer.createNodes).toHaveBeenCalledWith('(empty MCP response)', 'node')
      })

      it('throws when the tool reports isError', async () => {
        MCPClientManager.callTool.mockResolvedValue({isError: true, content: 'tool error detail'})
        const cmd = new MCPCommand(userId, workflowId, mockStore, httpAliasConfig)

        await expect(cmd.run(node, undefined, '/coder1 test')).rejects.toThrow('tool error detail')
        expect(mockStore.importer.createNodes).not.toHaveBeenCalled()
      })

      it('throws when callTool rejects', async () => {
        MCPClientManager.callTool.mockRejectedValue(new Error('connection refused'))
        const cmd = new MCPCommand(userId, workflowId, mockStore, httpAliasConfig)

        await expect(cmd.run(node, undefined, '/coder1 test')).rejects.toThrow('connection refused')
        expect(mockStore.importer.createNodes).not.toHaveBeenCalled()
      })
    })
  })

  describe('run — agent mode (toolName === "auto")', () => {
    const autoConfig = {...httpAliasConfig, toolName: 'auto'}
    const node = {id: 'node', command: '/coder1 build a feature'}

    it('routes to withClient, not callTool', async () => {
      setupAgentMocks('done')
      const cmd = new MCPCommand(userId, workflowId, mockStore, autoConfig)
      await cmd.run(node, undefined, '/coder1 build a feature')

      expect(MCPClientManager.withClient).toHaveBeenCalledTimes(1)
      expect(MCPClientManager.callTool).not.toHaveBeenCalled()
    })

    it('discovers tools via listTools on the shared client', async () => {
      const {mockClient} = setupAgentMocks('done')
      const cmd = new MCPCommand(userId, workflowId, mockStore, autoConfig)
      await cmd.run(node, undefined, '/coder1 build a feature')

      expect(mockClient.listTools).toHaveBeenCalledTimes(1)
    })

    it('wraps each discovered tool descriptor in MCPToolAdapter', async () => {
      setupAgentMocks('done')
      const cmd = new MCPCommand(userId, workflowId, mockStore, autoConfig)
      await cmd.run(node, undefined, '/coder1 build a feature')

      expect(MCPToolAdapter).toHaveBeenCalledTimes(mockToolDescriptors.length)
      mockToolDescriptors.forEach(descriptor => {
        expect(MCPToolAdapter).toHaveBeenCalledWith(expect.objectContaining({toolDescriptor: descriptor}))
      })
    })

    it('forwards timeoutMs to every MCPToolAdapter instance', async () => {
      setupAgentMocks('done')
      const cmd = new MCPCommand(userId, workflowId, mockStore, {...autoConfig, timeoutMs: 900_000})
      await cmd.run(node, undefined, '/coder1 task')

      expect(MCPToolAdapter).toHaveBeenCalledWith(expect.objectContaining({timeoutMs: 900_000}))
    })

    it('passes the LLM and adapter tools to createSimpleAgentExecutor', async () => {
      setupAgentMocks('done')
      const cmd = new MCPCommand(userId, workflowId, mockStore, autoConfig)
      await cmd.run(node, undefined, '/coder1 build a feature')

      expect(getAgentExecutorModule.createSimpleAgentExecutor).toHaveBeenCalledWith(
        expect.any(Object),
        expect.arrayContaining([expect.objectContaining({name: 'read_file'})]),
      )
    })

    describe('prompt assembly', () => {
      it('passes the full prompt including prepended context to the agent', async () => {
        const {executor} = setupAgentMocks('ok')
        const cmd = new MCPCommand(userId, workflowId, mockStore, autoConfig)
        await cmd.run(node, 'context text\n', '/coder1 task')

        expect(executor.call).toHaveBeenCalledWith({input: 'context text\ntask'}, {signal: undefined})
      })
    })

    describe('result → node output', () => {
      it('creates a node with the agent output', async () => {
        setupAgentMocks('agent produced this')
        const cmd = new MCPCommand(userId, workflowId, mockStore, autoConfig)
        await cmd.run(node, undefined, '/coder1 build a feature')

        expect(mockStore.importer.createNodes).toHaveBeenCalledWith('agent produced this', 'node')
      })

      it('creates fallback node when agent output is empty', async () => {
        setupAgentMocks('')
        const cmd = new MCPCommand(userId, workflowId, mockStore, autoConfig)
        await cmd.run(node, undefined, '/coder1 build')

        expect(mockStore.importer.createNodes).toHaveBeenCalledWith('(empty MCP response)', 'node')
      })

      it('throws when the agent run throws', async () => {
        MCPClientManager.withClient.mockRejectedValue(new Error('server unreachable'))
        const cmd = new MCPCommand(userId, workflowId, mockStore, autoConfig)

        await expect(cmd.run(node, undefined, '/coder1 build')).rejects.toThrow('server unreachable')
        expect(mockStore.importer.createNodes).not.toHaveBeenCalled()
      })
    })
  })

  describe('buildToolArguments', () => {
    const cmd = () => new MCPCommand(userId, workflowId, mockStore, httpAliasConfig)

    it('defaults the input field name to "prompt"', () => {
      expect(cmd().buildToolArguments('hello')).toEqual({prompt: 'hello'})
    })

    it('uses a custom toolInputField name when specified', () => {
      const c = new MCPCommand(userId, workflowId, mockStore, {...httpAliasConfig, toolInputField: 'query'})
      expect(c.buildToolArguments('hello')).toEqual({query: 'hello'})
    })

    it('treats empty string toolInputField as absent and falls back to "prompt"', () => {
      const c = new MCPCommand(userId, workflowId, mockStore, {...httpAliasConfig, toolInputField: ''})
      expect(c.buildToolArguments('hello')).toEqual({prompt: 'hello'})
    })

    it('merges toolStaticArgs underneath the dynamic input', () => {
      const c = new MCPCommand(userId, workflowId, mockStore, {
        ...httpAliasConfig,
        toolStaticArgs: {format: 'json', verbose: true},
      })
      expect(c.buildToolArguments('hello')).toEqual({prompt: 'hello', format: 'json', verbose: true})
    })

    it('dynamic input field overrides a colliding key in toolStaticArgs', () => {
      const c = new MCPCommand(userId, workflowId, mockStore, {
        ...httpAliasConfig,
        toolStaticArgs: {prompt: 'overridden'},
      })
      expect(c.buildToolArguments('actual')).toEqual({prompt: 'actual'})
    })

    it.each([
      ['empty toolStaticArgs', {}],
      ['undefined toolStaticArgs', undefined],
    ])('handles %s without error', (_label, toolStaticArgs) => {
      const c = new MCPCommand(userId, workflowId, mockStore, {...httpAliasConfig, toolStaticArgs})
      expect(c.buildToolArguments('hello')).toEqual({prompt: 'hello'})
    })
  })

  describe('extractPrompt', () => {
    const cmd = new MCPCommand(userId, workflowId, makeStore(), httpAliasConfig)

    it('prefers originalPrompt over node.command and node.title', () => {
      expect(cmd.extractPrompt({command: '/coder1 from-node'}, '/coder1 from-original')).toBe('from-original')
    })

    it('falls back to node.command when originalPrompt is absent', () => {
      expect(cmd.extractPrompt({command: '/coder1 from-node', title: '/coder1 from-title'}, undefined)).toBe(
        'from-node',
      )
    })

    it('falls back to node.title when node.command is absent', () => {
      expect(cmd.extractPrompt({title: '/coder1 from-title'}, undefined)).toBe('from-title')
    })

    it.each([
      ['node with neither command nor title', {id: 'n'}, undefined, ''],
      ['null node', null, undefined, ''],
      ['empty string originalPrompt', {command: '/coder1 fallback'}, '', 'fallback'],
    ])('returns expected result for %s', (_label, node, originalPrompt, expected) => {
      expect(cmd.extractPrompt(node, originalPrompt)).toBe(expected)
    })
  })

  describe('stripAliasPrefix', () => {
    const cmd = new MCPCommand(userId, workflowId, makeStore(), httpAliasConfig)

    it.each([
      ['alias followed by space and content', '/coder1 do something', 'do something'],
      ['alias with leading whitespace', '  /coder1 task', 'task'],
      ['alias only (no trailing content)', '/coder1', ''],
      ['alias followed by multiple spaces', '/coder1   spaced', 'spaced'],
      ['alias followed by tab', '/coder1\ttabbed', 'tabbed'],
    ])('strips alias prefix — %s', (_label, input, expected) => {
      expect(cmd.stripAliasPrefix(input)).toBe(expected)
    })

    it.each([
      ['text without the alias', '  plain text  ', 'plain text  '],
      ['superset of alias (/coder10)', '/coder10 extra', '/coder10 extra'],
      ['wrong case', '/Coder1 test', '/Coder1 test'],
      ['empty string', '', ''],
    ])('does not strip — %s', (_label, input, expected) => {
      expect(cmd.stripAliasPrefix(input)).toBe(expected)
    })
  })
})

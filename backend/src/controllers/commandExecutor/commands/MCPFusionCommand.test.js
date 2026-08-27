import {MCPFusionCommand} from './MCPFusionCommand'
import Store from './utils/Store'
import * as MCPClientManager from './mcp/MCPClientManager'
import * as getLLMModule from './utils/langchain/getLLM'
import * as getAgentExecutorModule from './utils/langchain/getAgentExecutor'
import {MCPToolAdapter} from './mcp/MCPToolAdapter'

jest.mock('./mcp/MCPClientManager', () => ({
  callTool: jest.fn(),
  listTools: jest.fn(),
  withClient: jest.fn(),
  withMultipleClients: jest.fn(),
  withMultipleClientsTolerant: jest.fn(),
  formatToolResult: jest.fn(),
}))

jest.mock('./utils/langchain/getLLM', () => ({
  getIntegrationSettings: jest.fn(),
  determineLLMType: jest.fn().mockReturnValue('OpenAI'),
  getLLM: jest.fn().mockReturnValue({llm: {bindTools: jest.fn()}, chunkSize: 4096}),
}))

jest.mock('./utils/langchain/getAgentExecutor', () => ({
  createSimpleAgentExecutor: jest.fn(),
  createMCPAgentExecutor: jest.fn(),
  assertToolCallingCapability: jest.fn(),
}))

jest.mock('./mcp/MCPToolAdapter', () => ({
  MCPToolAdapter: jest.fn().mockImplementation(({toolDescriptor}) => ({
    name: toolDescriptor.name,
  })),
}))

jest.mock('./mcp/internalServerEnv', () => ({
  isInternalMcpServer: jest.fn().mockReturnValue(false),
  buildInternalServerEnv: jest.fn().mockReturnValue({}),
  resolveInternalServerScript: jest.fn(s => s),
}))

const userId = 'user1'
const workflowId = 'wf1'

const makeStore = (mcpAliases = []) => {
  const store = new Store({userId, workflowId, nodes: {node1: {id: 'node1', title: 'parent'}}})
  store._aliases = {mcp: mcpAliases}
  store.importer.createNodes = jest.fn()
  store.importer.createErrorNode = jest.fn()
  return store
}
const getFirstOutputNode = store => {
  const {nodes} = store.getOutput()
  return nodes[0]
}

const makeAlias = (alias, overrides = {}) => ({
  alias,
  transport: 'streamable-http',
  serverUrl: 'http://localhost:3100',
  ...overrides,
})

const toolsA = [
  {name: 'read_file', description: 'read', inputSchema: {type: 'object', properties: {path: {type: 'string'}}}},
]
const toolsB = [
  {name: 'write_file', description: 'write', inputSchema: {type: 'object', properties: {path: {type: 'string'}}}},
  {name: 'list_dir', description: 'list', inputSchema: {type: 'object', properties: {}}},
]

const setupMultipleClientsMock = (clientToolsMap, agentOutput = 'fusion result') => {
  const clientMocks = clientToolsMap.map(tools => ({
    listTools: jest.fn().mockResolvedValue({tools}),
  }))

  MCPClientManager.withMultipleClientsTolerant.mockImplementation(async (_configs, fn) =>
    fn(clientMocks.map((client, index) => ({client, index}))),
  )

  const executor = {invoke: jest.fn().mockResolvedValue({output: agentOutput})}
  getAgentExecutorModule.createMCPAgentExecutor.mockReturnValue(executor)

  return {clientMocks, executor}
}

describe('MCPFusionCommand', () => {
  let mockStore

  beforeEach(() => {
    jest.clearAllMocks()
    getLLMModule.getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'key'}})
    getLLMModule.getLLM.mockReturnValue({llm: {bindTools: jest.fn()}, chunkSize: 4096})
    getAgentExecutorModule.assertToolCallingCapability.mockImplementation(() => {})
  })

  const node = {id: 'node1', command: '/mcp find all markers'}

  describe('run — happy path with multiple integrations', () => {
    it('opens clients for all configured MCP aliases', async () => {
      const aliases = [makeAlias('/tools'), makeAlias('/files')]
      mockStore = makeStore(aliases)
      setupMultipleClientsMock([toolsA, toolsB])

      const cmd = new MCPFusionCommand(userId, workflowId, mockStore)
      await cmd.run(node, undefined, '/mcp do something')

      expect(MCPClientManager.withMultipleClientsTolerant).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({serverUrl: 'http://localhost:3100', transport: 'streamable-http'}),
          expect.objectContaining({serverUrl: 'http://localhost:3100', transport: 'streamable-http'}),
        ]),
        expect.any(Function),
      )
    })

    it('namespaces tools with alias slug + double underscore', async () => {
      const aliases = [makeAlias('/tools'), makeAlias('/files')]
      mockStore = makeStore(aliases)
      setupMultipleClientsMock([toolsA, toolsB])

      const cmd = new MCPFusionCommand(userId, workflowId, mockStore)
      await cmd.run(node, undefined, '/mcp task')

      const adapterCalls = MCPToolAdapter.mock.calls.map(([args]) => args.toolDescriptor.name)
      expect(adapterCalls).toContain('tools__read_file')
      expect(adapterCalls).toContain('files__write_file')
      expect(adapterCalls).toContain('files__list_dir')
    })

    it('prefixes tool descriptions with alias name', async () => {
      const aliases = [makeAlias('/tools')]
      mockStore = makeStore(aliases)
      setupMultipleClientsMock([toolsA])

      const cmd = new MCPFusionCommand(userId, workflowId, mockStore)
      await cmd.run(node, undefined, '/mcp task')

      expect(MCPToolAdapter).toHaveBeenCalledWith(
        expect.objectContaining({
          toolDescriptor: expect.objectContaining({description: '[/tools] read'}),
        }),
      )
    })

    it('passes callName (original tool name) to MCPToolAdapter', async () => {
      const aliases = [makeAlias('/tools')]
      mockStore = makeStore(aliases)
      setupMultipleClientsMock([toolsA])

      const cmd = new MCPFusionCommand(userId, workflowId, mockStore)
      await cmd.run(node, undefined, '/mcp task')

      expect(MCPToolAdapter).toHaveBeenCalledWith(
        expect.objectContaining({
          callName: 'read_file',
          toolDescriptor: expect.objectContaining({name: 'tools__read_file'}),
        }),
      )
    })

    it('creates agent executor with merged tools from all aliases', async () => {
      const aliases = [makeAlias('/tools'), makeAlias('/files')]
      mockStore = makeStore(aliases)
      const {executor} = setupMultipleClientsMock([toolsA, toolsB])

      const cmd = new MCPFusionCommand(userId, workflowId, mockStore)
      await cmd.run(node, undefined, '/mcp task')

      expect(getAgentExecutorModule.createMCPAgentExecutor).toHaveBeenCalledWith(
        expect.any(Object),
        expect.arrayContaining([
          expect.objectContaining({name: 'tools__read_file'}),
          expect.objectContaining({name: 'files__write_file'}),
          expect.objectContaining({name: 'files__list_dir'}),
        ]),
      )
      expect(executor.invoke).toHaveBeenCalledTimes(1)
    })

    it('creates an output node with the agent result', async () => {
      const aliases = [makeAlias('/tools')]
      mockStore = makeStore(aliases)
      setupMultipleClientsMock([toolsA], 'the answer is 42')

      const cmd = new MCPFusionCommand(userId, workflowId, mockStore)
      await cmd.run(node, undefined, '/mcp question')

      const outputNode = getFirstOutputNode(mockStore)
      expect(outputNode.title).toContain('the answer is 42')
      expect(outputNode.parent).toBe('node1')
    })

    it('creates fallback node when agent output is empty', async () => {
      const aliases = [makeAlias('/tools')]
      mockStore = makeStore(aliases)
      setupMultipleClientsMock([toolsA], '')

      const cmd = new MCPFusionCommand(userId, workflowId, mockStore)
      await cmd.run(node, undefined, '/mcp question')

      const outputNode = getFirstOutputNode(mockStore)
      expect(outputNode.title).toContain('(empty MCP response)')
      expect(outputNode.parent).toBe('node1')
    })
  })

  describe('prompt assembly', () => {
    it('strips /mcp prefix from the prompt', async () => {
      const aliases = [makeAlias('/tools')]
      mockStore = makeStore(aliases)
      const {executor} = setupMultipleClientsMock([toolsA])

      const cmd = new MCPFusionCommand(userId, workflowId, mockStore)
      await cmd.run(node, undefined, '/mcp find all markers')

      expect(executor.invoke).toHaveBeenCalledWith({input: 'find all markers'}, expect.anything())
    })

    it('prepends context to the stripped prompt', async () => {
      const aliases = [makeAlias('/tools')]
      mockStore = makeStore(aliases)
      const {executor} = setupMultipleClientsMock([toolsA])

      const cmd = new MCPFusionCommand(userId, workflowId, mockStore)
      await cmd.run(node, 'context text\n', '/mcp task')

      expect(executor.invoke).toHaveBeenCalledWith({input: 'context text\ntask'}, expect.anything())
    })

    it('uses node.command when originalPrompt is absent', async () => {
      const aliases = [makeAlias('/tools')]
      mockStore = makeStore(aliases)
      const {executor} = setupMultipleClientsMock([toolsA])

      const cmd = new MCPFusionCommand(userId, workflowId, mockStore)
      await cmd.run({id: 'node1', command: '/mcp from node command'}, undefined, undefined)

      expect(executor.invoke).toHaveBeenCalledWith({input: 'from node command'}, expect.anything())
    })

    it('uses node.title when node.command is absent', async () => {
      const aliases = [makeAlias('/tools')]
      mockStore = makeStore(aliases)
      const {executor} = setupMultipleClientsMock([toolsA])

      const cmd = new MCPFusionCommand(userId, workflowId, mockStore)
      await cmd.run({id: 'node1', title: '/mcp from title'}, undefined, undefined)

      expect(executor.invoke).toHaveBeenCalledWith({input: 'from title'}, expect.anything())
    })
  })

  describe('error cases', () => {
    it('creates error node and does not throw when no MCP aliases are configured', async () => {
      mockStore = makeStore([])

      const cmd = new MCPFusionCommand(userId, workflowId, mockStore)
      await expect(cmd.run(node, undefined, '/mcp task')).resolves.toBeUndefined()

      expect(mockStore.importer.createErrorNode).toHaveBeenCalledWith(expect.stringContaining('Error:'), 'node1')
      expect(mockStore.importer.createErrorNode.mock.calls[0][0]).toMatch(/No MCP integrations/)
    })

    it('creates error node when LLM lacks tool-calling capability', async () => {
      const aliases = [makeAlias('/tools')]
      mockStore = makeStore(aliases)
      getAgentExecutorModule.assertToolCallingCapability.mockImplementation(() => {
        throw new Error('Agent mode requires an LLM with tool-calling support.')
      })

      const cmd = new MCPFusionCommand(userId, workflowId, mockStore)
      await cmd.run(node, undefined, '/mcp task')

      expect(mockStore.importer.createErrorNode).toHaveBeenCalledWith(expect.stringContaining('Error:'), 'node1')
      expect(MCPClientManager.withMultipleClientsTolerant).not.toHaveBeenCalled()
    })

    it('creates error node when no LLM is configured', async () => {
      const aliases = [makeAlias('/tools')]
      mockStore = makeStore(aliases)
      getLLMModule.getLLM.mockReturnValue({llm: null, chunkSize: 4096})

      const cmd = new MCPFusionCommand(userId, workflowId, mockStore)
      await cmd.run(node, undefined, '/mcp task')

      expect(mockStore.importer.createErrorNode).toHaveBeenCalledWith(expect.stringContaining('Error:'), 'node1')
      expect(MCPClientManager.withMultipleClientsTolerant).not.toHaveBeenCalled()
    })

    it('skips a failing alias and still runs the agent with tools from working aliases', async () => {
      const aliases = [makeAlias('/broken'), makeAlias('/files')]
      mockStore = makeStore(aliases)

      const brokenClient = {listTools: jest.fn().mockRejectedValue(new Error('server down'))}
      const workingClient = {listTools: jest.fn().mockResolvedValue({tools: toolsB})}

      MCPClientManager.withMultipleClientsTolerant.mockImplementation(async (_configs, fn) =>
        fn([
          {client: brokenClient, index: 0},
          {client: workingClient, index: 1},
        ]),
      )
      const executor = {invoke: jest.fn().mockResolvedValue({output: 'partial result'})}
      getAgentExecutorModule.createMCPAgentExecutor.mockReturnValue(executor)

      const cmd = new MCPFusionCommand(userId, workflowId, mockStore)
      await cmd.run(node, undefined, '/mcp task')

      expect(getAgentExecutorModule.createMCPAgentExecutor).toHaveBeenCalledWith(
        expect.any(Object),
        expect.arrayContaining([expect.objectContaining({name: 'files__write_file'})]),
      )
      const outputNode = getFirstOutputNode(mockStore)
      expect(outputNode.title).toContain('partial result')
    })

    it('reports unavailable integrations when connection fails before tool discovery', async () => {
      const aliases = [makeAlias('/broken'), makeAlias('/files')]
      mockStore = makeStore(aliases)

      const workingClient = {listTools: jest.fn().mockResolvedValue({tools: toolsB})}
      MCPClientManager.withMultipleClientsTolerant.mockImplementation(async (_configs, fn) =>
        fn([{client: workingClient, index: 1}], [{index: 0, error: new Error('connection refused')}]),
      )
      const executor = {invoke: jest.fn().mockResolvedValue({output: 'partial result'})}
      getAgentExecutorModule.createMCPAgentExecutor.mockReturnValue(executor)

      const cmd = new MCPFusionCommand(userId, workflowId, mockStore)
      await cmd.run(node, undefined, '/mcp task')

      const outputNode = getFirstOutputNode(mockStore)
      const report = outputNode.mcpFusionReport
      expect(report.unavailable).toContainEqual(
        expect.objectContaining({alias: '/broken', phase: 'connect', reason: 'connection refused'}),
      )
      expect(report.available).toContainEqual(
        expect.objectContaining({alias: '/files', toolNames: ['write_file', 'list_dir']}),
      )
    })

    it('reports tool provenance captured by the adapter callback', async () => {
      const aliases = [makeAlias('/tools')]
      mockStore = makeStore(aliases)

      const mockClient = {listTools: jest.fn().mockResolvedValue({tools: toolsA})}
      MCPClientManager.withMultipleClientsTolerant.mockImplementation(async (_configs, fn) =>
        fn([{client: mockClient, index: 0}], []),
      )
      const executor = {
        invoke: jest.fn().mockImplementation(async () => {
          const onCall = MCPToolAdapter.mock.calls[0][0].onCall
          onCall({status: 'success'})
          return {output: 'used tool'}
        }),
      }
      getAgentExecutorModule.createMCPAgentExecutor.mockReturnValue(executor)

      const cmd = new MCPFusionCommand(userId, workflowId, mockStore)
      await cmd.run(node, undefined, '/mcp task')

      const outputNode = getFirstOutputNode(mockStore)
      const report = outputNode.mcpFusionReport
      expect(report.toolCalls).toContainEqual(
        expect.objectContaining({alias: '/tools', toolName: 'read_file', status: 'success'}),
      )
    })

    it('creates error node when all aliases fail listTools and no tools are available', async () => {
      const aliases = [makeAlias('/broken')]
      mockStore = makeStore(aliases)

      const brokenClient = {listTools: jest.fn().mockRejectedValue(new Error('server down'))}
      MCPClientManager.withMultipleClientsTolerant.mockImplementation(async (_configs, fn) =>
        fn([{client: brokenClient, index: 0}]),
      )

      const cmd = new MCPFusionCommand(userId, workflowId, mockStore)
      await cmd.run(node, undefined, '/mcp task')

      expect(mockStore.importer.createErrorNode).toHaveBeenCalledWith(expect.stringContaining('Error:'), 'node1')
    })

    it('creates error node and does not throw when agent invocation fails', async () => {
      const aliases = [makeAlias('/tools')]
      mockStore = makeStore(aliases)

      const mockClient = {listTools: jest.fn().mockResolvedValue({tools: toolsA})}
      MCPClientManager.withMultipleClientsTolerant.mockImplementation(async (_configs, fn) =>
        fn([{client: mockClient, index: 0}]),
      )
      const executor = {invoke: jest.fn().mockRejectedValue(new Error('agent crashed'))}
      getAgentExecutorModule.createMCPAgentExecutor.mockReturnValue(executor)

      const cmd = new MCPFusionCommand(userId, workflowId, mockStore)
      await expect(cmd.run(node, undefined, '/mcp task')).resolves.toBeUndefined()

      expect(mockStore.importer.createErrorNode).toHaveBeenCalledWith(expect.stringContaining('Error:'), 'node1')
    })
  })

  describe('alias slug generation', () => {
    it.each([
      ['/tools', 'tools'],
      ['/my-server', 'my_server'],
      ['/my.server', 'my_server'],
      ['tools', 'tools'],
      ['/tools/v2', 'tools_v2'],
    ])('alias %s → prefix %s in tool names', async (alias, expectedPrefix) => {
      mockStore = makeStore([makeAlias(alias)])
      setupMultipleClientsMock([toolsA])

      const cmd = new MCPFusionCommand(userId, workflowId, mockStore)
      await cmd.run(node, undefined, '/mcp task')

      expect(MCPToolAdapter).toHaveBeenCalledWith(
        expect.objectContaining({
          toolDescriptor: expect.objectContaining({name: `${expectedPrefix}__read_file`}),
        }),
      )
    })
  })
})

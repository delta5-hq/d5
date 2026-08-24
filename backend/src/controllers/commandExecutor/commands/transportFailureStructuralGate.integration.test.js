import {MCPCommand} from './MCPCommand'
import {RPCCommand} from './RPCCommand'
import Store from './utils/Store'
import {HTTPExecutor} from './rpc/HTTPExecutor'
import {SSHExecutor} from './rpc/SSHExecutor'
import * as MCPClientManager from './mcp/MCPClientManager'
import {extractForkLeafOutputs} from '../reliability/core/ForkLeafExtractor'
import {ForkJudge} from '../reliability/core/ForkJudge'
import {deterministicFailureReason} from '../reliability/core/failureSemantics'

jest.mock('./mcp/MCPClientManager', () => ({
  callTool: jest.fn(),
  withClient: jest.fn(),
}))

const makeStore = command =>
  new Store({
    userId: 'transport-integration-user',
    workflowId: 'transport-integration-workflow',
    nodes: {root: {id: 'root', command, title: command, children: []}},
  })

const mcpAlias = {
  alias: '/tool',
  transport: 'streamable-http',
  serverUrl: 'https://mcp.invalid',
  toolName: 'run',
}

const httpAlias = {
  alias: '/http',
  protocol: 'http',
  url: 'https://rpc.invalid',
  method: 'POST',
  bodyTemplate: '{"prompt":"{{prompt}}"}',
  outputFormat: 'text',
}

const sshAlias = {
  alias: '/ssh',
  protocol: 'ssh',
  host: 'rpc.invalid',
  port: 22,
  username: 'runner',
  commandTemplate: 'run {{prompt}}',
  outputFormat: 'text',
}

async function expectStructuralRejection(store, expectedType, expectedCode) {
  const leafOutputs = extractForkLeafOutputs(store, 'root')
  expect(leafOutputs).toHaveLength(1)
  expect(leafOutputs[0]).toMatchObject({
    executionStatus: 'error',
    executionFailureType: expectedType,
    ...(expectedCode === undefined ? {} : {executionFailureCode: expectedCode}),
  })
  expect(deterministicFailureReason(leafOutputs[0])).toBe(expectedType)

  const verdict = await new ForkJudge(store._userId, store._workflowId, store).selectWinner({
    forks: [{forkIndex: 0, status: 'ok', forkStore: store, leafOutputs}],
    validateNodes: [],
    parentNodeId: 'root',
  })
  expect(verdict).toMatchObject({winnerForkIndex: null, allGateFiltered: true})
}

describe('transport adapter → error node → leaf signal → structural gate', () => {
  afterEach(() => jest.restoreAllMocks())

  it('preserves MCP isError as a discriminating gate rejection', async () => {
    MCPClientManager.callTool.mockResolvedValue({isError: true, content: 'private provider body'})
    const store = makeStore('/tool execute')
    const command = new MCPCommand(store._userId, store._workflowId, store, mcpAlias)
    command.logError = jest.fn()

    await command.run(store.getNode('root'), undefined, '/tool execute')

    await expectStructuralRejection(store, 'mcp-tool-error')
    expect(store.getNode(store.getNode('root').prompts[0]).title).not.toContain('private provider body')
  })

  it('preserves HTTP non-2xx status as a discriminating gate rejection without its body', async () => {
    jest
      .spyOn(HTTPExecutor.prototype, 'execute')
      .mockResolvedValue({body: 'private upstream body', status: 503, isError: true})
    const store = makeStore('/http execute')
    const command = new RPCCommand(store._userId, store._workflowId, store, httpAlias)
    command.logError = jest.fn()

    await command.run(store.getNode('root'), undefined, '/http execute')

    await expectStructuralRejection(store, 'http-status-error', 503)
    expect(store.getNode(store.getNode('root').prompts[0]).title).not.toContain('private upstream body')
  })

  it('preserves SSH nonzero exit as a discriminating gate rejection without stderr', async () => {
    jest
      .spyOn(SSHExecutor.prototype, 'execute')
      .mockResolvedValue({stdout: '', stderr: 'private remote stderr', exitCode: 126})
    const store = makeStore('/ssh execute')
    const command = new RPCCommand(store._userId, store._workflowId, store, sshAlias)
    command.logError = jest.fn()

    await command.run(store.getNode('root'), undefined, '/ssh execute')

    await expectStructuralRejection(store, 'ssh-exit-error', 126)
    expect(store.getNode(store.getNode('root').prompts[0]).title).not.toContain('private remote stderr')
  })

  it('preserves an unexpected adapter exception as the generic typed runtime rejection', async () => {
    MCPClientManager.callTool.mockRejectedValue(new Error('private connection detail'))
    const store = makeStore('/tool execute')
    const command = new MCPCommand(store._userId, store._workflowId, store, mcpAlias)
    command.logError = jest.fn()

    await command.run(store.getNode('root'), undefined, '/tool execute')

    await expectStructuralRejection(store, 'runtime-error')
    expect(store.getNode(store.getNode('root').prompts[0]).title).not.toContain('private connection detail')
  })

  it('does not invent a failure signal for successful MCP, HTTP, or SSH adapter output', async () => {
    const successText = 'A successful transport response with enough substantive content.'
    MCPClientManager.callTool.mockResolvedValue({isError: false, content: successText})
    jest.spyOn(HTTPExecutor.prototype, 'execute').mockResolvedValue({body: successText, status: 200, isError: false})
    jest.spyOn(SSHExecutor.prototype, 'execute').mockResolvedValue({stdout: successText, stderr: '', exitCode: 0})

    const cases = [
      {
        store: makeStore('/tool execute'),
        build: store => new MCPCommand(store._userId, store._workflowId, store, mcpAlias),
      },
      {
        store: makeStore('/http execute'),
        build: store => new RPCCommand(store._userId, store._workflowId, store, httpAlias),
      },
      {
        store: makeStore('/ssh execute'),
        build: store => new RPCCommand(store._userId, store._workflowId, store, sshAlias),
      },
    ]

    for (const {store, build} of cases) {
      const command = build(store)
      command.logError = jest.fn()
      await command.run(store.getNode('root'), undefined, store.getNode('root').command)
      const leafOutputs = extractForkLeafOutputs(store, 'root')
      expect(leafOutputs).toHaveLength(1)
      expect(leafOutputs[0].executionFailureType).toBeUndefined()
      const verdict = await new ForkJudge(store._userId, store._workflowId, store).selectWinner({
        forks: [{forkIndex: 0, status: 'ok', forkStore: store, leafOutputs}],
        validateNodes: [],
        parentNodeId: 'root',
      })
      expect(verdict).toMatchObject({winnerForkIndex: 0, allGateFiltered: false})
    }
  })
})

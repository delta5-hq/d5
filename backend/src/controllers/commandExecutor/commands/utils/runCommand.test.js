import {ChatCommand} from '../ChatCommand'
import {SummarizeCommand} from '../SummarizeCommand'
import executeExample1 from './exampleData/executeExample1.json'
import {runCommand} from './runCommand'
import Store from './Store'
import ProgressReporter from '../../ProgressReporter'
import {ForeachCommand} from '../ForeachCommand'
import {ValidateCommand} from '../../reliability/core/ValidateCommand'
import * as unknownCommandNode from './unknownCommandNode'
import {VALIDATE_QUERY_TYPE} from '../../constants/validate'
import {REFINE_QUERY_TYPE} from '../../constants/refine'

jest.useFakeTimers()
jest.mock('../../ProgressReporter', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      add: jest.fn(async label => label),
      remove: jest.fn(),
      dispose: jest.fn(),
      registerChild: jest.fn(),
    })),
  }
})

describe('runCommand', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should run 4 times chat and 1 times outline --summarize', async () => {
    const chatRunSpy = jest.spyOn(ChatCommand.prototype, 'run').mockReturnValue({nodes: []})
    const replyDefaultSpy = jest.spyOn(SummarizeCommand.prototype, 'replyDefault').mockResolvedValue('')

    const {workflowNodes, workflowFiles, ...data} = executeExample1
    const mockStore = new Store({
      userId: 'userId',
      nodes: workflowNodes,
      files: workflowFiles,
    })
    await runCommand({...data, store: mockStore})

    expect(chatRunSpy).toHaveBeenCalledTimes(4)
    expect(replyDefaultSpy).toHaveBeenCalledTimes(1)

    chatRunSpy.mockRestore()
    replyDefaultSpy.mockRestore()
  })

  it('should run outline --summarize via SummarizeCommand.replyDefault', async () => {
    const chatRunSpy = jest.spyOn(ChatCommand.prototype, 'run').mockReturnValue({nodes: []})
    const replyDefaultSpy = jest.spyOn(SummarizeCommand.prototype, 'replyDefault').mockResolvedValue('')

    const {workflowNodes, workflowFiles, ...data} = executeExample1
    const mockStore = new Store({
      userId: 'userId',
      nodes: workflowNodes,
      files: workflowFiles,
    })
    await runCommand({...data, store: mockStore})

    expect(replyDefaultSpy).toHaveBeenCalledTimes(1)

    chatRunSpy.mockRestore()
    replyDefaultSpy.mockRestore()
  })

  it('should run foreach only with prompts', async () => {
    const root = {
      id: 'root',
      parent: 'root',
      command: '/chatgpt prompt',
      children: ['c', 'for'],
    }
    const child = {id: 'c', parent: root.id, title: 'child'}
    const foreach = {
      id: 'for',
      parent: root.id,
      command: '/foreach /chatgpt @@',
    }

    const mockStore = new Store({
      userId: 'userId',
      nodes: {
        [root.id]: root,
        [child.id]: child,
        [foreach.id]: foreach,
      },
    })

    const chatRunSpy = jest
      .spyOn(ChatCommand.prototype, 'replyChatOpenAIAPI')
      .mockResolvedValue('response1\n\nresponse2')
    const executePrompts = jest.spyOn(ForeachCommand.prototype, 'executePrompts').mockReturnValue({
      nodes: [],
      edges: [],
    })

    await runCommand({
      queryType: 'chat',
      cell: root,
      store: mockStore,
    })

    const callArgs = executePrompts.mock.calls[0][0]
    expect(callArgs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          node: expect.objectContaining({parent: 'root', title: 'response1'}),
          promptString: '/chatgpt response1',
        }),
        expect.objectContaining({
          node: expect.objectContaining({parent: 'root', title: 'response2'}),
          promptString: '/chatgpt response2',
        }),
      ]),
    )

    chatRunSpy.mockRestore()
    executePrompts.mockRestore()
  })

  it('should create a ProgressReporter and track execution with add/remove/dispose', async () => {
    const root = {
      id: 'root',
      parent: 'root',
      command: '/chatgpt prompt',
      children: ['c'],
    }
    const child = {id: 'c', parent: root.id, title: 'child'}

    const workflowNodes = {
      [root.id]: root,
      [child.id]: child,
    }
    const mockStore = new Store({
      userId: 'userId',
      nodes: workflowNodes,
    })

    const rootProgress = new ProgressReporter({title: 'root'})

    const chatSpy = jest.spyOn(ChatCommand.prototype, 'run').mockResolvedValue({})

    await runCommand(
      {
        queryType: 'chat',
        cell: root,
        store: mockStore,
        userId: 'id',
      },
      rootProgress,
    )

    expect(ProgressReporter).toHaveBeenCalledWith({title: 'runCommand'}, rootProgress)

    const instance = ProgressReporter.mock.results[1].value

    expect(instance.add).toHaveBeenCalledWith('ChatCommand.run')
    expect(instance.remove).toHaveBeenCalledWith('ChatCommand.run')
    expect(instance.dispose).toHaveBeenCalled()

    chatSpy.mockRestore()
  })

  it('should create a ProgressReporter when it not provided in params', async () => {
    const root = {
      id: 'root',
      parent: 'root',
      command: '/chatgpt prompt',
      children: ['c'],
    }
    const child = {id: 'c', parent: root.id, title: 'runCommand'}

    const workflowNodes = {
      [root.id]: root,
      [child.id]: child,
    }
    const mockStore = new Store({
      userId: 'userId',
      nodes: workflowNodes,
    })

    const chatSpy = jest.spyOn(ChatCommand.prototype, 'run').mockResolvedValue({})

    await runCommand({
      queryType: 'chat',
      cell: root,
      store: mockStore,
      userId: 'id',
    })

    const progressCallArgs = ProgressReporter.mock.calls[0]
    expect(progressCallArgs).toEqual([{title: 'runCommand'}, undefined])
    chatSpy.mockRestore()
  })

  it('should call postProcess progress tracking when postProcessNode is triggered', async () => {
    const root = {
      id: 'root',
      parent: 'root',
      command: '/chatgpt prompt',
      children: ['c', 'for'],
    }
    const child = {id: 'c', parent: root.id, title: 'child'}
    const foreach = {
      id: 'for',
      parent: root.id,
      command: '/foreach /chatgpt @@',
    }

    const workflowNodes = {
      [root.id]: root,
      [child.id]: child,
      [foreach.id]: foreach,
    }
    const mockStore = new Store({
      userId: 'userId',
      nodes: workflowNodes,
    })

    const rootProgress = new ProgressReporter({title: 'root'})

    const mockedChatResult = {
      nodes: [
        {
          id: 'mocked-node',
          parent: root.id,
          title: 'result',
        },
      ],
    }
    const chatSpy = jest.spyOn(ChatCommand.prototype, 'run').mockResolvedValue(mockedChatResult)

    await runCommand(
      {
        queryType: 'chat',
        cell: root,
        store: mockStore,
        userId: 'id',
      },
      rootProgress,
    )

    const createdInstances = ProgressReporter.mock.instances
    expect(createdInstances.length).toBeGreaterThanOrEqual(2)

    const postProcessReporter = ProgressReporter.mock.results[2].value

    expect(postProcessReporter.add).toHaveBeenCalledWith('ForeachCommand.run')
    expect(postProcessReporter.dispose).toHaveBeenCalled()

    chatSpy.mockRestore()
  })

  describe('direct validate execution', () => {
    it('dispatches /validate through the command runner so a visible artifact can be created', async () => {
      const cell = {id: 'validate-node', parent: 'root', command: '/validate answer is useful', children: []}
      const parent = {id: 'root', parent: 'root', title: 'answer text', children: ['validate-node']}
      const store = new Store({userId: 'user-id', nodes: {root: parent, 'validate-node': cell}})
      const runSpy = jest.spyOn(ValidateCommand.prototype, 'run').mockResolvedValue({passed: true})

      await runCommand({queryType: 'validate', cell, store})

      expect(runSpy).toHaveBeenCalledWith(expect.objectContaining({id: 'validate-node'}))
      runSpy.mockRestore()
    })
  })

  describe('unrecognized command dispatch', () => {
    it('delegates to createUnknownCommandNode when no built-in, MCP alias, or RPC alias is matched', async () => {
      const cell = {id: 'root', parent: 'root', command: '/unregistered-alias prompt', children: []}
      const store = new Store({userId: 'user-id', nodes: {root: cell}})
      const spy = jest.spyOn(unknownCommandNode, 'createUnknownCommandNode')

      await runCommand({queryType: undefined, mcpAlias: undefined, rpcAlias: undefined, cell, store})

      expect(spy).toHaveBeenCalledWith(store, cell)
      spy.mockRestore()
    })

    it('error node title contains the alias extracted from the unrecognized command', async () => {
      const cell = {id: 'root', parent: 'root', command: '/ghost-alias run task', children: []}
      const store = new Store({userId: 'user-id', nodes: {root: cell}})
      jest.spyOn(store.importer, 'createNodes')

      await runCommand({queryType: undefined, mcpAlias: undefined, rpcAlias: undefined, cell, store})

      expect(store.importer.createNodes).toHaveBeenCalledWith('Error: Unknown command "/ghost-alias"', 'root')
    })

    it('error node title contains (unknown) when cell command is absent', async () => {
      const cell = {id: 'root', parent: 'root', command: undefined, children: []}
      const store = new Store({userId: 'user-id', nodes: {root: cell}})
      jest.spyOn(store.importer, 'createNodes')

      await runCommand({queryType: undefined, mcpAlias: undefined, rpcAlias: undefined, cell, store})

      expect(store.importer.createNodes).toHaveBeenCalledWith('Error: Unknown command "(unknown)"', 'root')
    })
  })
})

const SUBSTANTIVE_OUTPUT = 'Substantive analysis output that passes the structural gate check.'

describe('runCommand — commodity :n=N on plain LLM cells', () => {
  const makeRoot = command => ({
    id: 'root',
    parent: 'root',
    command,
    children: [],
  })

  const runWithCount = async command => {
    const root = makeRoot(command)
    const store = new Store({userId: 'userId', nodes: {[root.id]: root}})
    let callCount = 0
    const spy = jest
      .spyOn(require('../ChatCommand').ChatCommand.prototype, 'run')
      .mockImplementation(async function () {
        callCount++
        this.store.createNode(
          {
            parent: root.id,
            title: `${SUBSTANTIVE_OUTPUT} Fork ${callCount}.`,
          },
          true,
        )
      })
    await runCommand({queryType: 'chat', cell: root, store})
    spy.mockRestore()
    const children = Object.values(store._nodes).filter(nd => nd.parent === root.id)
    return {callCount, childCount: children.length}
  }

  it.each([
    [2, '/chat :n=2 List 3 colors'],
    [3, '/chat :n=3 List 3 colors'],
  ])(':n=%i runs ChatCommand exactly N times and produces exactly N children', async (n, command) => {
    const {callCount, childCount} = await runWithCount(command)
    expect(callCount).toBe(n)
    expect(childCount).toBe(n)
  })

  it(':n=1 (explicit minimum) runs once', async () => {
    const root = makeRoot('/chat :n=1 List 3 colors')
    const store = new Store({userId: 'userId', nodes: {[root.id]: root}})
    let callCount = 0
    const spy = jest
      .spyOn(require('../ChatCommand').ChatCommand.prototype, 'run')
      .mockImplementation(async function () {
        callCount++
      })
    await runCommand({queryType: 'chat', cell: root, store})
    spy.mockRestore()
    expect(callCount).toBe(1)
  })

  it('no :n= token (default) runs once — existing behavior unchanged', async () => {
    const root = makeRoot('/chat List 3 colors')
    const store = new Store({userId: 'userId', nodes: {[root.id]: root}})
    let callCount = 0
    const spy = jest
      .spyOn(require('../ChatCommand').ChatCommand.prototype, 'run')
      .mockImplementation(async function () {
        callCount++
      })
    await runCommand({queryType: 'chat', cell: root, store})
    spy.mockRestore()
    expect(callCount).toBe(1)
  })

  const runCommodityOutcomes = async outcomes => {
    const root = makeRoot(`/chat :n=${outcomes.length} List 3 colors`)
    const store = new Store({userId: 'userId', nodes: {[root.id]: root}})
    let callCount = 0
    const spy = jest
      .spyOn(require('../ChatCommand').ChatCommand.prototype, 'run')
      .mockImplementation(async function () {
        const outcome = outcomes[callCount]
        callCount++

        switch (outcome) {
          case 'success':
            this.store.createNode({parent: root.id, title: `${SUBSTANTIVE_OUTPUT} Fork ${callCount}.`}, true)
            return
          case 'refusal':
            this.store.createNode({parent: root.id, title: "I'm sorry, I cannot assist with that."}, true)
            return
          case 'empty':
            this.store.createNode({parent: root.id, title: '   '}, true)
            return
          case 'error':
            this.store.importer.createErrorNode('Error: provider failure', root.id)
            return
          default:
            return
        }
      })

    try {
      await runCommand({queryType: 'chat', cell: root, store})
    } finally {
      spy.mockRestore()
    }

    return {
      callCount,
      rootTitle: root.title,
      childTitles: Object.values(store._nodes)
        .filter(nd => nd.parent === root.id)
        .map(nd => nd.title),
    }
  }

  it.each([
    {
      name: 'all forks produce substantive output',
      outcomes: ['success', 'success'],
      suffix: /\[✓ 2\/2\]/,
      childCount: 2,
    },
    {
      name: 'all three forks produce substantive output',
      outcomes: ['success', 'success', 'success'],
      suffix: /\[✓ 3\/3\]/,
      childCount: 3,
    },
    {
      name: 'one refusal and one substantive output',
      outcomes: ['refusal', 'success'],
      suffix: /\[✓ 1\/2 ⚠\]/,
      childCount: 1,
    },
    {
      name: 'all forks produce refusal output',
      outcomes: ['refusal', 'refusal', 'refusal'],
      suffix: /\[✗ 0\/3\]/,
      childCount: 0,
    },
    {name: 'no fork produces output', outcomes: ['none', 'none'], suffix: /\[✗ 0\/2\]/, childCount: 0},
    {name: 'all forks produce empty output', outcomes: ['empty', 'empty'], suffix: /\[✗ 0\/2\]/, childCount: 0},
    {
      name: 'all forks produce machine-tagged error nodes',
      outcomes: ['error', 'error', 'error'],
      suffix: /\[✗ 0\/3\]/,
      childCount: 0,
    },
    {
      name: 'one machine-tagged error and one substantive output',
      outcomes: ['error', 'success'],
      suffix: /\[✓ 1\/2 ⚠\]/,
      childCount: 1,
    },
  ])('classifies commodity fork outcomes: $name', async ({outcomes, suffix, childCount}) => {
    const result = await runCommodityOutcomes(outcomes)

    expect(result.callCount).toBe(outcomes.length)
    expect(result.rootTitle).toMatch(suffix)
    expect(result.childTitles).toHaveLength(childCount)
    result.childTitles.forEach(title => expect(title).toContain(SUBSTANTIVE_OUTPUT))
  })

  it('no :n= token — no suffix written on root cell', async () => {
    const root = makeRoot('/chat List 3 colors')
    const store = new Store({userId: 'userId', nodes: {[root.id]: root}})
    const spy = jest
      .spyOn(require('../ChatCommand').ChatCommand.prototype, 'run')
      .mockImplementation(async function () {
        this.store.createNode({parent: root.id, title: 'output'}, true)
      })
    await runCommand({queryType: 'chat', cell: root, store})
    spy.mockRestore()
    expect(root.title || '').not.toMatch(/\[/)
  })
})

describe('runCommand — commodity :n=N on legacy node (command in title, not command field)', () => {
  it(':n=2 triggers commodity forks when command is stored in title field', async () => {
    const root = {
      id: 'root',
      parent: 'root',
      title: '/chat :n=2 List 3 colors',
      children: [],
    }
    const store = new Store({userId: 'userId', nodes: {[root.id]: root}})
    let callCount = 0
    const spy = jest
      .spyOn(require('../ChatCommand').ChatCommand.prototype, 'run')
      .mockImplementation(async function () {
        callCount++
        this.store.createNode(
          {
            parent: root.id,
            title: `${SUBSTANTIVE_OUTPUT} Fork ${callCount}.`,
          },
          true,
        )
      })
    await runCommand({queryType: 'chat', cell: root, store})
    spy.mockRestore()
    expect(callCount).toBe(2)
    const children = Object.values(store._nodes).filter(nd => nd.parent === root.id)
    expect(children).toHaveLength(2)
  })
})

describe('runCommand — commodity :n=N with real ChatCommand + NoopLLM (MOCK_EXTERNAL_SERVICES)', () => {
  const ORIG_ENV = process.env.MOCK_EXTERNAL_SERVICES

  beforeAll(() => {
    jest.useRealTimers()
    process.env.MOCK_EXTERNAL_SERVICES = 'true'
  })

  afterAll(() => {
    jest.useFakeTimers()
    process.env.MOCK_EXTERNAL_SERVICES = ORIG_ENV
  })

  it.each([
    [2, '/chat :n=2 List 3 colors'],
    [3, '/chat :n=3 Describe the sky'],
  ])('produces exactly %i children and matching success suffix via real importer (NoopLLM)', async (n, command) => {
    const root = {id: 'root', parent: null, command, children: []}
    const store = new Store({userId: 'userId', nodes: {[root.id]: root}})
    store._integrationSettingsCache = {}

    await runCommand({queryType: 'chat', cell: root, store})

    const children = Object.values(store._nodes).filter(nd => nd.parent === root.id)
    expect(children).toHaveLength(n)
    expect(store._nodes.root.title).toMatch(new RegExp(`\\[✓ ${n}/${n}\\]`))
  })
})

describe('runCommand — commodity :n=N is stripped from task text before being sent to the LLM', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it.each([
    ['/chat :n=2 Reply with one word: hello', 'Reply with one word: hello'],
    ['/chat :n=3 Analyze this topic', 'Analyze this topic'],
    ['/chat :n=2', ''],
    ['/chat Text before :n=2 text after', 'Text before text after'],
    ['/chat Task text :n=3', 'Task text'],
    ['/chat :n=1 runs once anyway', 'runs once anyway'],
  ])('"%s" — LLM receives task text without :n=N', async (command, expectedTaskText) => {
    const root = {id: 'root', parent: null, command, children: []}
    const store = new Store({userId: 'userId', nodes: {[root.id]: root}})
    const capturedMessages = []
    jest.spyOn(ChatCommand.prototype, 'replyChatOpenAIAPI').mockImplementation(async function (messages) {
      capturedMessages.push(...messages)
      return 'output'
    })

    await runCommand({queryType: 'chat', cell: root, store})

    expect(capturedMessages.length).toBeGreaterThan(0)
    capturedMessages.forEach(msg => {
      expect(msg.content).not.toMatch(/:n=\d+/)
      if (expectedTaskText) {
        expect(msg.content).toContain(expectedTaskText)
      }
    })
  })
})

describe('runCommand — commodity :n=N control parameter does not appear in generated child node content', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it.each([2, 3])(
    ':n=%i child node titles contain no :n= token — control parameter does not leak into generated content',
    async n => {
      const root = {id: 'root', parent: null, command: `/chat :n=${n} Reply with one word: hello`, children: []}
      const store = new Store({userId: 'userId', nodes: {[root.id]: root}})
      jest.spyOn(ChatCommand.prototype, 'replyChatOpenAIAPI').mockResolvedValue('hello')

      await runCommand({queryType: 'chat', cell: root, store})

      const children = Object.values(store._nodes).filter(nd => nd.parent === root.id && nd.id !== root.id)
      expect(children.length).toBeGreaterThan(0)
      children.forEach(child => {
        expect(child.title).not.toMatch(/:n=\d+/)
      })
    },
  )
})

describe('runCommand — modifier commands used as root', () => {
  it.each([
    {queryType: VALIDATE_QUERY_TYPE, command: '/validate criterion'},
    {queryType: REFINE_QUERY_TYPE, command: '/refine :n=2'},
  ])('writes [✗ !] suffix and error node without dispatching ($queryType)', async ({queryType, command}) => {
    const root = {id: 'root', parent: 'root', command, children: []}
    const store = new Store({userId: 'userId', nodes: {[root.id]: root}})
    const chatSpy = jest.spyOn(ChatCommand.prototype, 'run').mockResolvedValue({})
    const createErrorSpy = jest.spyOn(store.importer, 'createErrorNode')

    await runCommand({queryType, cell: root, store})

    chatSpy.mockRestore()
    expect(chatSpy).not.toHaveBeenCalled()
    expect(createErrorSpy).toHaveBeenCalledTimes(1)
    expect(createErrorSpy.mock.calls[0][0]).toMatch(new RegExp(`/${queryType} requires a parent cell`))
    const outputCell = store.getOutput().nodes.find(n => n.id === root.id)
    expect(outputCell?.title).toMatch(/\[✗ !\]/)
  })
})

describe('runCommand — preventCommodityForks option', () => {
  it('preventCommodityForks=true forces a single execution regardless of :n=N in the command', async () => {
    const root = {
      id: 'root',
      parent: 'root',
      command: '/chat :n=3 prompt',
      children: [],
    }
    const store = new Store({userId: 'userId', nodes: {[root.id]: root}})
    let callCount = 0
    const spy = jest.spyOn(ChatCommand.prototype, 'run').mockImplementation(async function () {
      callCount++
    })
    await runCommand({
      queryType: 'chat',
      cell: root,
      store,
      preventCommodityForks: true,
    })
    spy.mockRestore()
    expect(callCount).toBe(1)
  })

  it('does not write a commodity suffix when preventCommodityForks=true even though :n=N is present in the command', async () => {
    const root = {
      id: 'root',
      parent: 'root',
      command: '/chat :n=2 prompt',
      children: [],
    }
    const store = new Store({userId: 'userId', nodes: {[root.id]: root}})
    const spy = jest.spyOn(ChatCommand.prototype, 'run').mockResolvedValue({})
    await runCommand({
      queryType: 'chat',
      cell: root,
      store,
      preventCommodityForks: true,
    })
    spy.mockRestore()
    expect(root.title ?? '').not.toMatch(/\[/)
  })

  it('runs once (no fork) when preventCommodityForks=true and no :n=N is present', async () => {
    const root = {
      id: 'root',
      parent: 'root',
      command: '/chat prompt',
      children: [],
    }
    const store = new Store({userId: 'userId', nodes: {[root.id]: root}})
    let callCount = 0
    const spy = jest.spyOn(ChatCommand.prototype, 'run').mockImplementation(async function () {
      callCount++
    })
    await runCommand({
      queryType: 'chat',
      cell: root,
      store,
      preventCommodityForks: true,
    })
    spy.mockRestore()
    expect(callCount).toBe(1)
  })
})

describe('runCommand — store.withinForkExecution suppresses commodity forking inside forked subtrees', () => {
  it.each([2, 3, 5])(
    'executes exactly once regardless of :n=%i — routing re-entry and /refine subtree both use this guard',
    async n => {
      const root = {
        id: 'root',
        parent: 'root',
        command: `/chat :n=${n} prompt`,
        children: [],
      }
      const store = new Store({userId: 'userId', nodes: {[root.id]: root}})
      store.withinForkExecution = true
      let callCount = 0
      const spy = jest.spyOn(ChatCommand.prototype, 'run').mockImplementation(async function () {
        callCount++
      })
      await runCommand({queryType: 'chat', cell: root, store})
      spy.mockRestore()
      expect(callCount).toBe(1)
    },
  )

  it('writes no commodity suffix when store.withinForkExecution is true', async () => {
    const root = {
      id: 'root',
      parent: 'root',
      command: '/chat :n=3 prompt',
      children: [],
    }
    const store = new Store({userId: 'userId', nodes: {[root.id]: root}})
    store.withinForkExecution = true
    const spy = jest.spyOn(ChatCommand.prototype, 'run').mockResolvedValue({})
    await runCommand({queryType: 'chat', cell: root, store})
    spy.mockRestore()
    expect(root.title ?? '').not.toMatch(/\[/)
  })

  it('runs once when store.withinForkExecution is true and no :n= is present', async () => {
    const root = {
      id: 'root',
      parent: 'root',
      command: '/chat prompt',
      children: [],
    }
    const store = new Store({userId: 'userId', nodes: {[root.id]: root}})
    store.withinForkExecution = true
    let callCount = 0
    const spy = jest.spyOn(ChatCommand.prototype, 'run').mockImplementation(async function () {
      callCount++
    })
    await runCommand({queryType: 'chat', cell: root, store})
    spy.mockRestore()
    expect(callCount).toBe(1)
  })

  it('forks normally when store.withinForkExecution is false (default Store value)', async () => {
    const root = {
      id: 'root',
      parent: 'root',
      command: '/chat :n=2 prompt',
      children: [],
    }
    const store = new Store({userId: 'userId', nodes: {[root.id]: root}})
    let callCount = 0
    const spy = jest.spyOn(ChatCommand.prototype, 'run').mockImplementation(async function () {
      callCount++
    })
    await runCommand({queryType: 'chat', cell: root, store})
    spy.mockRestore()
    expect(callCount).toBe(2)
  })
})

describe('runCommand — preventPostProcess option', () => {
  it('preventPostProcess=true prevents child command execution after the main LLM call', async () => {
    const root = {
      id: 'root',
      parent: 'root',
      command: '/chat prompt',
      children: ['fe'],
    }
    const fe = {
      id: 'fe',
      parent: 'root',
      command: '/foreach /chat @@',
      children: [],
    }
    const store = new Store({
      userId: 'userId',
      nodes: {[root.id]: root, [fe.id]: fe},
    })

    const chatSpy = jest.spyOn(ChatCommand.prototype, 'run').mockResolvedValue({})
    const foreachRunSpy = jest.spyOn(ForeachCommand.prototype, 'run').mockResolvedValue({})

    await runCommand({
      queryType: 'chat',
      cell: root,
      store,
      preventPostProcess: true,
    })

    expect(chatSpy).toHaveBeenCalledTimes(1)
    expect(foreachRunSpy).not.toHaveBeenCalled()

    chatSpy.mockRestore()
    foreachRunSpy.mockRestore()
  })

  it('preventPostProcess=false (default) allows child command execution after the main LLM call', async () => {
    const root = {
      id: 'root',
      parent: 'root',
      command: '/chat prompt',
      children: ['fe'],
    }
    const fe = {
      id: 'fe',
      parent: 'root',
      command: '/foreach /chat @@',
      children: [],
    }
    const store = new Store({
      userId: 'userId',
      nodes: {[root.id]: root, [fe.id]: fe},
    })

    const chatSpy = jest.spyOn(ChatCommand.prototype, 'run').mockResolvedValue({})
    const foreachRunSpy = jest.spyOn(ForeachCommand.prototype, 'run').mockResolvedValue({})

    await runCommand({queryType: 'chat', cell: root, store})

    expect(chatSpy).toHaveBeenCalledTimes(1)
    expect(foreachRunSpy).toHaveBeenCalledTimes(1)

    chatSpy.mockRestore()
    foreachRunSpy.mockRestore()
  })
})

describe('runCommand — signal (AbortController) abort gating', () => {
  const makeChatWithForeachStore = () => {
    const root = {
      id: 'root',
      parent: 'root',
      command: '/chat prompt',
      children: ['fe'],
    }
    const fe = {
      id: 'fe',
      parent: 'root',
      command: '/foreach /chat @@',
      children: [],
    }
    const store = new Store({
      userId: 'userId',
      nodes: {[root.id]: root, [fe.id]: fe},
    })

    return {root, store}
  }

  const makeCommodityStore = n => {
    const root = {
      id: 'root',
      parent: null,
      command: `/chat :n=${n} prompt`,
      children: [],
    }
    const store = new Store({userId: 'userId', nodes: {[root.id]: root}})

    return {root, store}
  }

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it.each([
    {
      name: 'before command dispatch',
      prepare: () => {
        const {root, store} = makeChatWithForeachStore()
        const controller = new AbortController()
        controller.abort()
        return {
          controller,
          root,
          store,
          expectedChatCalls: 0,
          expectedForeachCalls: 0,
        }
      },
    },
    {
      name: 'during main command execution',
      prepare: () => {
        const {root, store} = makeChatWithForeachStore()
        const controller = new AbortController()
        return {
          controller,
          root,
          store,
          expectedChatCalls: 1,
          expectedForeachCalls: 0,
          abortDuringChat: true,
        }
      },
    },
    {
      name: 'inside post-processing',
      prepare: () => {
        const {root, store} = makeChatWithForeachStore()
        const controller = new AbortController()
        return {
          controller,
          root,
          store,
          expectedChatCalls: 1,
          expectedForeachCalls: 1,
          abortInsideForeach: true,
        }
      },
    },
  ])('propagates AbortError and stops execution when cancellation occurs $name', async ({prepare}) => {
    const {controller, root, store, expectedChatCalls, expectedForeachCalls, abortDuringChat, abortInsideForeach} =
      prepare()
    const chatSpy = jest.spyOn(ChatCommand.prototype, 'run').mockImplementation(async () => {
      if (abortDuringChat) controller.abort()
      return {}
    })
    const foreachRunSpy = jest.spyOn(ForeachCommand.prototype, 'run').mockImplementation(async () => {
      if (!abortInsideForeach) return {}
      controller.abort()
      const error = new Error('Operation cancelled')
      error.name = 'AbortError'
      throw error
    })

    await expect(
      runCommand({
        queryType: 'chat',
        cell: root,
        store,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({
      name: 'AbortError',
    })

    expect(chatSpy).toHaveBeenCalledTimes(expectedChatCalls)
    expect(foreachRunSpy).toHaveBeenCalledTimes(expectedForeachCalls)
  })

  it.each([2, 3])('passes signal into every commodity fork execution for :n=%i', async n => {
    const {root, store} = makeCommodityStore(n)
    const signal = new AbortController().signal
    const chatSpy = jest.spyOn(ChatCommand.prototype, 'run').mockResolvedValue({})

    await runCommand({queryType: 'chat', cell: root, store, signal})

    expect(chatSpy).toHaveBeenCalledTimes(n)
    expect(chatSpy.mock.calls.map(call => call[3])).toEqual(Array.from({length: n}, () => ({signal})))
  })

  it.each([2, 3])(
    'throws AbortError and does not commit commodity fork output when :n=%i is canceled before merge',
    async n => {
      const {root, store} = makeCommodityStore(n)
      const controller = new AbortController()
      const chatSpy = jest.spyOn(ChatCommand.prototype, 'run').mockImplementation(async function runFork(node) {
        this.store.importer.createNodes(`fork-output-${node.id}`, node.id)
        controller.abort()
      })

      await expect(
        runCommand({
          queryType: 'chat',
          cell: root,
          store,
          signal: controller.signal,
        }),
      ).rejects.toMatchObject({
        name: 'AbortError',
      })

      expect(chatSpy).toHaveBeenCalledTimes(n)
      expect(store.getNode('root').prompts ?? []).toEqual([])
      expect(store.getNode('root').command).toBe(`/chat :n=${n} prompt`)
    },
  )
})

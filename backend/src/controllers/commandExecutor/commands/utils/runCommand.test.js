import {ChatCommand} from '../ChatCommand'
import {OutlineCommand} from '../OutlineCommand'
import executeExample1 from './exampleData/executeExample1.json'
import {runCommand} from './runCommand'
import Store from './Store'
import ProgressReporter from '../../ProgressReporter'
import {ForeachCommand} from '../ForeachCommand'
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

  it('should run 4 times chat and 1 times outline', async () => {
    const chatRunSpy = jest.spyOn(ChatCommand.prototype, 'run').mockReturnValue({nodes: []})
    const outlineRunSpy = jest.spyOn(OutlineCommand.prototype, 'run').mockReturnValue({nodes: []})

    const {workflowNodes, workflowFiles, ...data} = executeExample1
    const mockStore = new Store({
      userId: 'userId',
      nodes: workflowNodes,
      files: workflowFiles,
    })
    await runCommand({...data, store: mockStore})

    expect(chatRunSpy).toHaveBeenCalledTimes(4)
    expect(outlineRunSpy).toHaveBeenCalledTimes(1)

    chatRunSpy.mockRestore()
    outlineRunSpy.mockRestore()
  })

  it('should run summarize outline', async () => {
    const chatRunSpy = jest.spyOn(ChatCommand.prototype, 'run').mockReturnValue({nodes: []})
    const outlineSummarizeSpy = jest.spyOn(OutlineCommand.prototype, 'replyWithSummarize').mockReturnValue([])

    const {workflowNodes, workflowFiles, ...data} = executeExample1
    const mockStore = new Store({
      userId: 'userId',
      nodes: workflowNodes,
      files: workflowFiles,
    })
    await runCommand({...data, store: mockStore})

    expect(outlineSummarizeSpy).toHaveBeenCalledTimes(1)

    chatRunSpy.mockRestore()
    outlineSummarizeSpy.mockRestore()
  })

  it('should run foreach only with prompts', async () => {
    const root = {id: 'root', parent: 'root', command: '/chatgpt prompt', children: ['c', 'for']}
    const child = {id: 'c', parent: root.id, title: 'child'}
    const foreach = {id: 'for', parent: root.id, command: '/foreach /chatgpt @@'}

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
    const root = {id: 'root', parent: 'root', command: '/chatgpt prompt', children: ['c']}
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
    const root = {id: 'root', parent: 'root', command: '/chatgpt prompt', children: ['c']}
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
    const root = {id: 'root', parent: 'root', command: '/chatgpt prompt', children: ['c', 'for']}
    const child = {id: 'c', parent: root.id, title: 'child'}
    const foreach = {id: 'for', parent: root.id, command: '/foreach /chatgpt @@'}

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
})

const SUBSTANTIVE_OUTPUT = 'Substantive analysis output that passes the structural gate check.'

describe('runCommand — commodity :n=N on plain LLM cells', () => {
  const makeRoot = command => ({id: 'root', parent: 'root', command, children: []})

  const runWithCount = async command => {
    const root = makeRoot(command)
    const store = new Store({userId: 'userId', nodes: {[root.id]: root}})
    let callCount = 0
    const spy = jest
      .spyOn(require('../ChatCommand').ChatCommand.prototype, 'run')
      .mockImplementation(async function () {
        callCount++
        this.store.createNode({parent: root.id, title: `${SUBSTANTIVE_OUTPUT} Fork ${callCount}.`}, true)
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

  it(':n=2 writes [✓ 2/2] suffix on root cell when both forks produce substantive output', async () => {
    const root = makeRoot('/chat :n=2 List 3 colors')
    const store = new Store({userId: 'userId', nodes: {[root.id]: root}})
    let callCount = 0
    const spy = jest
      .spyOn(require('../ChatCommand').ChatCommand.prototype, 'run')
      .mockImplementation(async function () {
        callCount++
        this.store.createNode({parent: root.id, title: `${SUBSTANTIVE_OUTPUT} Fork ${callCount}.`}, true)
      })
    await runCommand({queryType: 'chat', cell: root, store})
    spy.mockRestore()
    // root is mutated in-place by runCommodityForks before removeOrphanedNodes runs
    expect(root.title).toMatch(/\[✓ 2\/2\]/)
  })

  it(':n=3 writes [✓ 3/3] suffix on root cell when all forks produce substantive output', async () => {
    const root = makeRoot('/chat :n=3 List 3 fruits')
    const store = new Store({userId: 'userId', nodes: {[root.id]: root}})
    let callCount = 0
    const spy = jest
      .spyOn(require('../ChatCommand').ChatCommand.prototype, 'run')
      .mockImplementation(async function () {
        callCount++
        this.store.createNode({parent: root.id, title: `${SUBSTANTIVE_OUTPUT} Fork ${callCount}.`}, true)
      })
    await runCommand({queryType: 'chat', cell: root, store})
    spy.mockRestore()
    expect(root.title).toMatch(/\[✓ 3\/3\]/)
  })

  it(':n=2 writes [✓ 1/2] when one fork produces a refusal and one produces substantive output', async () => {
    const root = makeRoot('/chat :n=2 List 3 colors')
    const store = new Store({userId: 'userId', nodes: {[root.id]: root}})
    let callCount = 0
    const spy = jest
      .spyOn(require('../ChatCommand').ChatCommand.prototype, 'run')
      .mockImplementation(async function () {
        callCount++
        const title =
          callCount === 1 ? "I'm sorry, I cannot help with that request." : `${SUBSTANTIVE_OUTPUT} Fork ${callCount}.`
        this.store.createNode({parent: root.id, title}, true)
      })
    await runCommand({queryType: 'chat', cell: root, store})
    spy.mockRestore()
    expect(root.title).toMatch(/\[✓ 1\/2\]/)
  })

  it(':n=3 writes [✗ 0/3] when all forks produce refusal output', async () => {
    const root = makeRoot('/chat :n=3 List 3 colors')
    const store = new Store({userId: 'userId', nodes: {[root.id]: root}})
    const spy = jest
      .spyOn(require('../ChatCommand').ChatCommand.prototype, 'run')
      .mockImplementation(async function () {
        this.store.createNode({parent: root.id, title: "I'm sorry, I cannot assist with that."}, true)
      })
    await runCommand({queryType: 'chat', cell: root, store})
    spy.mockRestore()
    expect(root.title).toMatch(/\[✗ 0\/3\]/)
  })

  it(':n=2 writes [✗ 0/2] suffix when no fork produces output', async () => {
    const root = makeRoot('/chat :n=2 List 3 colors')
    const store = new Store({userId: 'userId', nodes: {[root.id]: root}})
    const spy = jest
      .spyOn(require('../ChatCommand').ChatCommand.prototype, 'run')
      .mockImplementation(async function () {})
    await runCommand({queryType: 'chat', cell: root, store})
    spy.mockRestore()
    expect(root.title).toMatch(/\[✗ 0\/2\]/)
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
    const root = {id: 'root', parent: 'root', title: '/chat :n=2 List 3 colors', children: []}
    const store = new Store({userId: 'userId', nodes: {[root.id]: root}})
    let callCount = 0
    const spy = jest
      .spyOn(require('../ChatCommand').ChatCommand.prototype, 'run')
      .mockImplementation(async function () {
        callCount++
        this.store.createNode({parent: root.id, title: `${SUBSTANTIVE_OUTPUT} Fork ${callCount}.`}, true)
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

describe('runCommand — modifier commands used as root', () => {
  it.each([
    {queryType: VALIDATE_QUERY_TYPE, command: '/validate criterion'},
    {queryType: REFINE_QUERY_TYPE, command: '/refine :n=2'},
  ])('writes [✗ invalid] suffix and error node without dispatching ($queryType)', async ({queryType, command}) => {
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
    expect(outputCell?.title).toMatch(/\[✗ invalid\]/)
  })
})

describe('runCommand — preventCommodityForks option', () => {
  it('preventCommodityForks=true forces a single execution regardless of :n=N in the command', async () => {
    const root = {id: 'root', parent: 'root', command: '/chat :n=3 prompt', children: []}
    const store = new Store({userId: 'userId', nodes: {[root.id]: root}})
    let callCount = 0
    const spy = jest.spyOn(ChatCommand.prototype, 'run').mockImplementation(async function () {
      callCount++
    })
    await runCommand({queryType: 'chat', cell: root, store, preventCommodityForks: true})
    spy.mockRestore()
    expect(callCount).toBe(1)
  })

  it('does not write a commodity suffix when preventCommodityForks=true even though :n=N is present in the command', async () => {
    const root = {id: 'root', parent: 'root', command: '/chat :n=2 prompt', children: []}
    const store = new Store({userId: 'userId', nodes: {[root.id]: root}})
    const spy = jest.spyOn(ChatCommand.prototype, 'run').mockResolvedValue({})
    await runCommand({queryType: 'chat', cell: root, store, preventCommodityForks: true})
    spy.mockRestore()
    expect(root.title ?? '').not.toMatch(/\[/)
  })

  it('runs once (no fork) when preventCommodityForks=true and no :n=N is present', async () => {
    const root = {id: 'root', parent: 'root', command: '/chat prompt', children: []}
    const store = new Store({userId: 'userId', nodes: {[root.id]: root}})
    let callCount = 0
    const spy = jest.spyOn(ChatCommand.prototype, 'run').mockImplementation(async function () {
      callCount++
    })
    await runCommand({queryType: 'chat', cell: root, store, preventCommodityForks: true})
    spy.mockRestore()
    expect(callCount).toBe(1)
  })
})

describe('runCommand — preventPostProcess option', () => {
  it('preventPostProcess=true prevents child command execution after the main LLM call', async () => {
    const root = {id: 'root', parent: 'root', command: '/chat prompt', children: ['fe']}
    const fe = {id: 'fe', parent: 'root', command: '/foreach /chat @@', children: []}
    const store = new Store({userId: 'userId', nodes: {[root.id]: root, [fe.id]: fe}})

    const chatSpy = jest.spyOn(ChatCommand.prototype, 'run').mockResolvedValue({})
    const foreachRunSpy = jest.spyOn(ForeachCommand.prototype, 'run').mockResolvedValue({})

    await runCommand({queryType: 'chat', cell: root, store, preventPostProcess: true})

    expect(chatSpy).toHaveBeenCalledTimes(1)
    expect(foreachRunSpy).not.toHaveBeenCalled()

    chatSpy.mockRestore()
    foreachRunSpy.mockRestore()
  })

  it('preventPostProcess=false (default) allows child command execution after the main LLM call', async () => {
    const root = {id: 'root', parent: 'root', command: '/chat prompt', children: ['fe']}
    const fe = {id: 'fe', parent: 'root', command: '/foreach /chat @@', children: []}
    const store = new Store({userId: 'userId', nodes: {[root.id]: root, [fe.id]: fe}})

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
  it('already-aborted signal prevents child post-processing while the main LLM call still executes', async () => {
    const root = {id: 'root', parent: 'root', command: '/chat prompt', children: ['fe']}
    const fe = {id: 'fe', parent: 'root', command: '/foreach /chat @@', children: []}
    const store = new Store({userId: 'userId', nodes: {[root.id]: root, [fe.id]: fe}})

    const controller = new AbortController()
    controller.abort()

    const chatSpy = jest.spyOn(ChatCommand.prototype, 'run').mockResolvedValue({})
    const foreachRunSpy = jest.spyOn(ForeachCommand.prototype, 'run').mockResolvedValue({})

    await runCommand({queryType: 'chat', cell: root, store, signal: controller.signal})

    expect(chatSpy).toHaveBeenCalledTimes(1)
    expect(foreachRunSpy).not.toHaveBeenCalled()

    chatSpy.mockRestore()
    foreachRunSpy.mockRestore()
  })
})

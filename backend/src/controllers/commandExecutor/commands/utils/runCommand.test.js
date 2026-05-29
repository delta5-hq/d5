import {ChatCommand} from '../ChatCommand'
import {OutlineCommand} from '../OutlineCommand'
import executeExample1 from './exampleData/executeExample1.json'
import {runCommand} from './runCommand'
import Store from './Store'
import ProgressReporter from '../../ProgressReporter'
import {ForeachCommand} from '../ForeachCommand'

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

  it(':n=2 runs ChatCommand exactly 2 times and produces exactly 2 children', async () => {
    const {callCount, childCount} = await runWithCount('/chat :n=2 List 3 colors')
    expect(callCount).toBe(2)
    expect(childCount).toBe(2)
  })

  it(':n=3 runs ChatCommand exactly 3 times and produces exactly 3 children', async () => {
    const {callCount, childCount} = await runWithCount('/chat :n=3 List 3 colors')
    expect(callCount).toBe(3)
    expect(childCount).toBe(3)
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
    // Legacy nodes may use title instead of command; getNodeCommand falls back to title
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

  it('creates N children in main store via real importer.createNodes path', async () => {
    const root = {id: 'root', parent: 'root', command: '/chat :n=2 List 3 colors', children: []}
    const store = new Store({userId: 'userId', nodes: {[root.id]: root}})

    await runCommand({queryType: 'chat', cell: root, store})

    const children = Object.values(store._nodes).filter(nd => nd.parent === root.id && nd.id !== root.id)
    expect(children.length).toBeGreaterThanOrEqual(2)
  })
})

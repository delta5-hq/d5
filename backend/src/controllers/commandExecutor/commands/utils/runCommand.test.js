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

    const {mapNodes, mapFiles, ...data} = executeExample1
    const mockStore = new Store({
      userId: 'userId',
      nodes: mapNodes,
      files: mapFiles,
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

    const {mapNodes, mapFiles, ...data} = executeExample1
    const mockStore = new Store({
      userId: 'userId',
      nodes: mapNodes,
      files: mapFiles,
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

    const mapNodes = {
      [root.id]: root,
      [child.id]: child,
    }
    const mockStore = new Store({
      userId: 'userId',
      nodes: mapNodes,
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

    const mapNodes = {
      [root.id]: root,
      [child.id]: child,
    }
    const mockStore = new Store({
      userId: 'userId',
      nodes: mapNodes,
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

    const mapNodes = {
      [root.id]: root,
      [child.id]: child,
      [foreach.id]: foreach,
    }
    const mockStore = new Store({
      userId: 'userId',
      nodes: mapNodes,
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

import {runCommand} from './runCommand'
import Store from './Store'
import {RefineNStrategy} from '../../reliability'
import {RefineCommand} from '../RefineCommand'

jest.mock('../../reliability', () => ({
  BestOfNStrategy: {execute: jest.fn()},
  CommandFactory: {
    isLLMCommand: jest.fn(() => true),
    isOrchestrator: jest.fn(() => false),
    createRunner: jest.fn(() => jest.fn().mockResolvedValue()),
  },
  NullProgress: jest.fn(),
  RefineNStrategy: {execute: jest.fn().mockResolvedValue()},
}))

jest.mock('../ChatCommand', () => ({
  ChatCommand: jest.fn().mockImplementation(() => ({run: jest.fn().mockResolvedValue()})),
}))

jest.mock('../../ProgressReporter', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    add: jest.fn(async label => label),
    remove: jest.fn(),
    dispose: jest.fn(),
    registerChild: jest.fn(),
  })),
}))

jest.mock('./langchain/getLLM', () => ({
  getIntegrationSettings: jest.fn().mockResolvedValue({}),
  determineLLMType: jest.fn(() => 'OpenAI'),
  getLLM: jest.fn(),
}))

jest.mock('../references/substitution', () => ({
  substituteReferencesAndHashrefsChildrenAndSelf: jest.fn(node => node.title ?? ''),
  substituteReferences: jest.fn(str => str),
}))

const buildStore = (refineCommand, extraNodes = {}) => {
  const root = {
    id: 'root',
    parent: 'root',
    command: '/chatgpt analyse',
    children: ['refine'],
    prompts: ['o1'],
  }
  const nodes = {
    root,
    o1: {id: 'o1', parent: 'root', title: 'Output text'},
    refine: {id: 'refine', parent: 'root', command: refineCommand},
    ...extraNodes,
  }
  return new Store({userId: 'u1', nodes})
}

describe('runCommand — /refine :n=N dispatch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should delegate to RefineNStrategy.execute when :n=N > 1 and parent is LLM command', async () => {
    const store = buildStore('/refine :n=3')
    const root = store._nodes.root

    await runCommand({queryType: 'chat', cell: root, store, userId: 'u1', prompt: 'analyse topic'})

    expect(RefineNStrategy.execute).toHaveBeenCalledWith(
      expect.any(Function),
      store,
      'root',
      'refine',
      'analyse topic',
      3,
      expect.any(Object),
    )
  })

  it('should delegate with minimum N=2', async () => {
    const store = buildStore('/refine :n=2')
    const root = store._nodes.root

    await runCommand({queryType: 'chat', cell: root, store, userId: 'u1', prompt: 'topic'})

    expect(RefineNStrategy.execute).toHaveBeenCalledWith(
      expect.any(Function),
      store,
      'root',
      'refine',
      'topic',
      2,
      expect.any(Object),
    )
  })

  it.each([
    ['/refine improve clarity', 'no :n= param'],
    ['/refine :n=1', ':n=1'],
  ])('should fall back to single-pass replyRefine for %s', async refineCommand => {
    const store = buildStore(refineCommand)
    const root = store._nodes.root
    const replyRefineSpy = jest.spyOn(RefineCommand.prototype, 'replyRefine').mockResolvedValue('refined')

    await runCommand({queryType: 'chat', cell: root, store, userId: 'u1', prompt: 'test'})

    expect(RefineNStrategy.execute).not.toHaveBeenCalled()
    expect(replyRefineSpy).toHaveBeenCalled()
  })

  it('should fall back to single-pass when parent is orchestrator', async () => {
    const {CommandFactory} = require('../../reliability')
    CommandFactory.isOrchestrator.mockReturnValueOnce(true).mockReturnValueOnce(true)

    const store = buildStore('/refine :n=3')
    const root = store._nodes.root
    const replyRefineSpy = jest.spyOn(RefineCommand.prototype, 'replyRefine').mockResolvedValue('refined')

    await runCommand({queryType: 'chat', cell: root, store, userId: 'u1', prompt: 'test'})

    expect(RefineNStrategy.execute).not.toHaveBeenCalled()
    expect(replyRefineSpy).toHaveBeenCalled()
  })

  it('should fall back to single-pass when parent is not LLM command', async () => {
    const {CommandFactory} = require('../../reliability')
    CommandFactory.isLLMCommand.mockReturnValueOnce(true).mockReturnValueOnce(false)

    const store = buildStore('/refine :n=3')
    const root = store._nodes.root
    const replyRefineSpy = jest.spyOn(RefineCommand.prototype, 'replyRefine').mockResolvedValue('refined')

    await runCommand({queryType: 'chat', cell: root, store, userId: 'u1', prompt: 'test'})

    expect(RefineNStrategy.execute).not.toHaveBeenCalled()
    expect(replyRefineSpy).toHaveBeenCalled()
  })

  it('should dispatch by title field when refine node has title instead of command', async () => {
    const store = buildStore('/refine :n=2')
    store._nodes.refine.command = undefined
    store._nodes.refine.title = '/refine :n=2'
    const root = store._nodes.root

    await runCommand({queryType: 'chat', cell: root, store, userId: 'u1', prompt: 'topic'})

    expect(RefineNStrategy.execute).toHaveBeenCalled()
  })

  it('should pass criteria from refine node children to RefineNStrategy', async () => {
    const store = buildStore('/refine :n=2', {
      criteriaNode: {id: 'criteriaNode', parent: 'refine', title: 'Must include revenue figures'},
    })
    store._nodes.refine.children = ['criteriaNode']
    const root = store._nodes.root

    await runCommand({queryType: 'chat', cell: root, store, userId: 'u1', prompt: 'analyse topic'})

    const callArgs = RefineNStrategy.execute.mock.calls[0]
    expect(callArgs[6]).toMatchObject({criteria: expect.stringContaining('Must include revenue figures')})
  })

  it('should pass undefined criteria when refine node has no children', async () => {
    const store = buildStore('/refine :n=2')
    store._nodes.refine.children = []
    const root = store._nodes.root

    await runCommand({queryType: 'chat', cell: root, store, userId: 'u1', prompt: 'analyse topic'})

    const callArgs = RefineNStrategy.execute.mock.calls[0]
    expect(callArgs[6].criteria).toBeUndefined()
  })

  it('should forward prompt to RefineNStrategy.execute unchanged', async () => {
    const store = buildStore('/refine :n=2')
    const root = store._nodes.root

    await runCommand({queryType: 'chat', cell: root, store, userId: 'u1', prompt: 'specific user prompt text'})

    expect(RefineNStrategy.execute).toHaveBeenCalledWith(
      expect.any(Function),
      store,
      'root',
      'refine',
      'specific user prompt text',
      2,
      expect.any(Object),
    )
  })
})

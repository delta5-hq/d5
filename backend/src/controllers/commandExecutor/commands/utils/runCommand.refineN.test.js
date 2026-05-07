import {runCommand} from './runCommand'
import Store from './Store'
import {RefineNStrategy, CandidateEvaluator} from '../../reliability'
import {RefineCommand} from '../RefineCommand'

jest.mock('../../reliability', () => ({
  BestOfNStrategy: {execute: jest.fn()},
  CandidateEvaluator: {isErrorText: jest.fn(() => false)},
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

  describe('judge option forwarding from refine child node', () => {
    it.each([
      [':judge=anthropic', 'judgeFamily', 'anthropic'],
      [':judge_reasoning=true', 'judgeReasoning', true],
      [':judge_samples=3', 'judgeSamples', 3],
      [':judge_ensemble=2', 'judgeEnsemble', 2],
    ])('reads %s from the refine child node command, not the parent', async (param, key, expected) => {
      const store = buildStore(`/refine :n=2 ${param}`)
      const root = store._nodes.root

      await runCommand({queryType: 'chat', cell: root, store, userId: 'u1', prompt: 'topic'})

      const judgeOpts = RefineNStrategy.execute.mock.calls[0][6]
      expect(judgeOpts[key]).toEqual(expected)
    })

    it('passes default judge options when refine child has no judge params', async () => {
      const store = buildStore('/refine :n=2')
      const root = store._nodes.root

      await runCommand({queryType: 'chat', cell: root, store, userId: 'u1', prompt: 'topic'})

      const judgeOpts = RefineNStrategy.execute.mock.calls[0][6]
      expect(judgeOpts.judgeFamily).toBeNull()
      expect(judgeOpts.judgeReasoning).toBe(false)
      expect(judgeOpts.judgeSamples).toBe(1)
      expect(judgeOpts.judgeEnsemble).toBe(1)
    })

    it('parent cell judge params do not flow into RefineN execution', async () => {
      const store = buildStore('/refine :n=2')
      store._nodes.root.command = '/chatgpt analyse :judge=openai'
      const root = store._nodes.root

      await runCommand({queryType: 'chat', cell: root, store, userId: 'u1', prompt: 'topic'})

      const judgeOpts = RefineNStrategy.execute.mock.calls[0][6]
      expect(judgeOpts.judgeFamily).toBeNull()
    })
  })
})

describe('runCommand — legacy single-pass /refine suffix', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should write refined suffix on the /refine child node after single-pass replyRefine', async () => {
    const store = buildStore('/refine improve clarity')
    const root = store._nodes.root
    jest.spyOn(RefineCommand.prototype, 'replyRefine').mockResolvedValue('refined output')

    await runCommand({queryType: 'chat', cell: root, store, userId: 'u1', prompt: 'test'})

    expect(store._nodes.refine.title).toContain('[✓ refined]')
  })

  it('should register /refine child node in store output after single-pass replyRefine', async () => {
    const store = buildStore('/refine improve clarity')
    const root = store._nodes.root
    jest.spyOn(RefineCommand.prototype, 'replyRefine').mockResolvedValue('refined output')

    await runCommand({queryType: 'chat', cell: root, store, userId: 'u1', prompt: 'test'})

    expect(store._output.nodes).toContain('refine')
  })

  it('should strip prior suffix before writing the refined suffix', async () => {
    const store = buildStore('/refine improve clarity')
    store._nodes.refine.title = '/refine improve clarity [✓ refined]'
    const root = store._nodes.root
    jest.spyOn(RefineCommand.prototype, 'replyRefine').mockResolvedValue('output')

    await runCommand({queryType: 'chat', cell: root, store, userId: 'u1', prompt: 'test'})

    const title = store._nodes.refine.title
    expect(title).toContain('[✓ refined]')
    expect(title.match(/\[✓ refined\]/g)).toHaveLength(1)
  })

  it('should write failure suffix and register refine node in output when replyRefine returns null', async () => {
    const store = buildStore('/refine improve clarity')
    const root = store._nodes.root
    jest.spyOn(RefineCommand.prototype, 'replyRefine').mockResolvedValue(null)

    await runCommand({queryType: 'chat', cell: root, store, userId: 'u1', prompt: 'test'})

    expect(store._nodes.refine.title).toContain('[✗ refine failed]')
    expect(store._output.nodes).toContain('refine')
  })

  it('should write failure suffix when replyRefine returns an error string', async () => {
    const store = buildStore('/refine improve clarity')
    const root = store._nodes.root
    jest.spyOn(RefineCommand.prototype, 'replyRefine').mockResolvedValue('Error: LLM call failed')
    CandidateEvaluator.isErrorText.mockReturnValue(true)

    await runCommand({queryType: 'chat', cell: root, store, userId: 'u1', prompt: 'test'})

    expect(store._nodes.refine.title).toContain('[✗ refine failed]')
    expect(store._output.nodes).toContain('refine')
  })
})

describe('runCommand — stale reliability suffix stripping on re-execute', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each([
    ['bestOfN success', 'analyse topic [✓ 2/2 best of 2]', 'analyse topic'],
    ['bestOfN failure', 'analyse topic [✗ 0/3 passed]', 'analyse topic'],
    ['refined', 'analyse topic [✓ refined]', 'analyse topic'],
  ])('should strip %s suffix from cell title before re-executing', async (_, dirtyTitle, cleanTitle) => {
    const store = buildStore('/refine improve clarity')
    const root = store._nodes.root
    root.command = '/chatgpt analyse'
    root.title = dirtyTitle

    await runCommand({queryType: 'chat', cell: root, store, userId: 'u1', prompt: 'test'})

    expect(root.title).toBe(cleanTitle)
  })

  it('should not strip title text that does not match the reliability suffix pattern', async () => {
    const store = buildStore('/refine improve clarity')
    const root = store._nodes.root
    root.command = '/chatgpt analyse'
    root.title = 'analyse competitors [important]'

    await runCommand({queryType: 'chat', cell: root, store, userId: 'u1', prompt: 'test'})

    expect(root.title).toBe('analyse competitors [important]')
  })
})

describe('runCommand — integration settings propagation', () => {
  let getIntegrationSettings

  beforeEach(() => {
    jest.clearAllMocks()
    getIntegrationSettings = require('./langchain/getLLM').getIntegrationSettings
  })

  describe('bestOfN dispatch path', () => {
    const buildBestOfNStore = () => {
      const root = {
        id: 'root',
        parent: 'root',
        command: '/chatgpt analyse :n=3',
        children: [],
        prompts: ['o1'],
      }
      const nodes = {
        root,
        o1: {id: 'o1', parent: 'root', title: 'Output'},
      }
      return new Store({userId: 'u1', workflowId: 'wf-99', nodes})
    }

    it('forwards store workflowId to getIntegrationSettings in bestOfN path', async () => {
      const {BestOfNStrategy} = require('../../reliability')
      BestOfNStrategy.execute.mockResolvedValue()
      const store = buildBestOfNStore()

      await runCommand({queryType: 'chat', cell: store._nodes.root, store, userId: 'u1', prompt: 'analyse'})

      expect(getIntegrationSettings).toHaveBeenCalledWith('u1', 'wf-99', store)
    })

    it('forwards store reference to getIntegrationSettings enabling cache use in bestOfN path', async () => {
      const {BestOfNStrategy} = require('../../reliability')
      BestOfNStrategy.execute.mockResolvedValue()
      const store = buildBestOfNStore()

      await runCommand({queryType: 'chat', cell: store._nodes.root, store, userId: 'u1', prompt: 'analyse'})

      const [, , storeArg] = getIntegrationSettings.mock.calls[0]
      expect(storeArg).toBe(store)
    })

    it('passes store._workflowId as-is to getIntegrationSettings when workflowId not set', async () => {
      const {BestOfNStrategy} = require('../../reliability')
      BestOfNStrategy.execute.mockResolvedValue()
      const root = {
        id: 'root',
        parent: 'root',
        command: '/chatgpt analyse :n=2',
        children: [],
        prompts: ['o1'],
      }
      const store = new Store({userId: 'u1', nodes: {root, o1: {id: 'o1', parent: 'root', title: 'Out'}}})

      await runCommand({queryType: 'chat', cell: root, store, userId: 'u1', prompt: 'analyse'})

      expect(getIntegrationSettings).toHaveBeenCalledWith('u1', store._workflowId, store)
    })
  })

  describe('refineN post-process path', () => {
    const buildRefineNStore = workflowId => {
      const root = {
        id: 'root',
        parent: 'root',
        command: '/chatgpt analyse',
        children: ['refine'],
        prompts: ['o1'],
      }
      const nodes = {
        root,
        o1: {id: 'o1', parent: 'root', title: 'Output'},
        refine: {id: 'refine', parent: 'root', command: '/refine :n=3'},
      }
      return new Store({userId: 'u1', workflowId, nodes})
    }

    it('forwards store workflowId to getIntegrationSettings in refineN path', async () => {
      const {RefineNStrategy} = require('../../reliability')
      RefineNStrategy.execute.mockResolvedValue()
      const store = buildRefineNStore('wf-42')

      await runCommand({queryType: 'chat', cell: store._nodes.root, store, userId: 'u1', prompt: 'analyse'})

      expect(getIntegrationSettings).toHaveBeenCalledWith('u1', 'wf-42', store)
    })

    it('forwards store reference to getIntegrationSettings enabling cache use in refineN path', async () => {
      const {RefineNStrategy} = require('../../reliability')
      RefineNStrategy.execute.mockResolvedValue()
      const store = buildRefineNStore('wf-55')

      await runCommand({queryType: 'chat', cell: store._nodes.root, store, userId: 'u1', prompt: 'analyse'})

      const storeArgs = getIntegrationSettings.mock.calls.map(call => call[2])
      expect(storeArgs.every(arg => arg === store)).toBe(true)
    })

    it('passes null workflowId when store has no workflowId in refineN path', async () => {
      const {RefineNStrategy} = require('../../reliability')
      RefineNStrategy.execute.mockResolvedValue()
      const store = buildRefineNStore(null)

      await runCommand({queryType: 'chat', cell: store._nodes.root, store, userId: 'u1', prompt: 'analyse'})

      expect(getIntegrationSettings).toHaveBeenCalledWith('u1', null, store)
    })
  })
})

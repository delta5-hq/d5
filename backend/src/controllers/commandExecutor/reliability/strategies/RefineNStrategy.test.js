import RefineNStrategy from './RefineNStrategy'
import StoreFork from '../core/StoreFork'
import CandidateEvaluator from '../core/CandidateEvaluator'
import LLMJudge from '../core/LLMJudge'
import Store from '../../commands/utils/Store'

jest.mock('../core/StoreFork')
jest.mock('../core/CandidateEvaluator')
jest.mock('../core/LLMJudge')

const makeStore = (prompts = [], extraNodes = {}) => {
  const parentNode = {id: 'parent', title: 'Run analysis', command: '/claude analyse', children: ['refine'], prompts}
  const refineNode = {id: 'refine', title: '/refine', command: '/refine'}
  const nodes = {parent: parentNode, refine: refineNode, ...extraNodes}
  return new Store({userId: 'u1', nodes})
}

const makeFork = (outputNodeIds = ['out1'], edgeIds = []) => {
  const nodes = Object.fromEntries(outputNodeIds.map(id => [id, {id, title: `Output ${id}`}]))
  nodes.parent = {
    id: 'parent',
    title: 'Run analysis',
    command: '/claude analyse',
    children: ['refine'],
    prompts: outputNodeIds,
  }
  const fork = new Store({userId: 'u1', nodes})
  outputNodeIds.forEach(id => fork.saveNodeToOutput(id))
  edgeIds.forEach(id => fork.saveEdgeToOutput(id))
  return fork
}

describe('RefineNStrategy', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    StoreFork.createFork.mockImplementation(() => makeFork())
  })

  describe('N-candidate parallel execution', () => {
    it('should create N-1 forks for N > 1', async () => {
      CandidateEvaluator.validate.mockReturnValue({pass: true, reason: null})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0, reason: null})

      const runner = jest.fn().mockResolvedValue()
      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})

      await RefineNStrategy.execute(runner, store, 'parent', 'refine', 'prompt', 3, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(StoreFork.createFork).toHaveBeenCalledTimes(2)
      expect(runner).toHaveBeenCalledTimes(2)
    })

    it('should create zero forks and skip judge when N = 1', async () => {
      CandidateEvaluator.validate.mockReturnValue({pass: true, reason: null})

      const runner = jest.fn()
      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})

      await RefineNStrategy.execute(runner, store, 'parent', 'refine', 'prompt', 1, {})

      expect(StoreFork.createFork).not.toHaveBeenCalled()
      expect(runner).not.toHaveBeenCalled()
      expect(LLMJudge.evaluate).not.toHaveBeenCalled()
    })

    it('should pass forked store to runner, not original', async () => {
      CandidateEvaluator.validate.mockReturnValue({pass: true, reason: null})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0, reason: null})

      const fork = makeFork()
      StoreFork.createFork.mockReturnValueOnce(fork)

      const runner = jest.fn().mockResolvedValue()
      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})

      await RefineNStrategy.execute(runner, store, 'parent', 'refine', 'prompt', 2, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(runner).toHaveBeenCalledWith(fork, expect.anything())
    })
  })

  describe('winner selection', () => {
    it('should leave parent prompts and store output unchanged when existing output wins', async () => {
      CandidateEvaluator.validate.mockReturnValue({pass: true, reason: null})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0, reason: null})

      const runner = jest.fn().mockResolvedValue()
      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})
      const originalPrompts = [...store._nodes.parent.prompts]

      await RefineNStrategy.execute(runner, store, 'parent', 'refine', 'prompt', 2, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(store._nodes.parent.prompts).toEqual(originalPrompts)
      expect(store._output.nodes).toEqual([])
      expect(store._output.edges).toEqual([])
    })

    it('should merge fork output nodes into store and register them for downstream persistence when fork wins', async () => {
      const winnerFork = makeFork(['forkOut1'])

      StoreFork.createFork.mockReturnValueOnce(winnerFork)
      CandidateEvaluator.validate.mockReturnValue({pass: true, reason: null})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 1, reason: null})

      const runner = jest.fn().mockResolvedValue()
      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})

      await RefineNStrategy.execute(runner, store, 'parent', 'refine', 'prompt', 2, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(store._nodes.forkOut1).toBeDefined()
      expect(store._output.nodes).toContain('forkOut1')
      expect(store._nodes.parent.prompts).toEqual(['forkOut1'])
      expect(store._nodes.parent.children).toContain('refine')
      expect(store._nodes.parent.command).toBe('/claude analyse')
      expect(store._nodes.parent.title).toBe('Run analysis')
    })

    it('should register all output nodes when fork produces multiple output nodes', async () => {
      const winnerFork = makeFork(['forkOut1', 'forkOut2'])

      StoreFork.createFork.mockReturnValueOnce(winnerFork)
      CandidateEvaluator.validate.mockReturnValue({pass: true, reason: null})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 1, reason: null})

      const runner = jest.fn().mockResolvedValue()
      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})

      await RefineNStrategy.execute(runner, store, 'parent', 'refine', 'prompt', 2, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(store._output.nodes).toContain('forkOut1')
      expect(store._output.nodes).toContain('forkOut2')
      expect(store._nodes.forkOut1).toBeDefined()
      expect(store._nodes.forkOut2).toBeDefined()
    })

    it('should merge fork output edges into store and register them for downstream persistence when fork wins', async () => {
      const winnerFork = makeFork(['forkOut1'], ['e1'])
      winnerFork._edges = {e1: {id: 'e1', start: 'forkOut1', end: 'forkOut2'}}

      StoreFork.createFork.mockReturnValueOnce(winnerFork)
      CandidateEvaluator.validate.mockReturnValue({pass: true, reason: null})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 1, reason: null})

      const runner = jest.fn().mockResolvedValue()
      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})

      await RefineNStrategy.execute(runner, store, 'parent', 'refine', 'prompt', 2, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(store._edges.e1).toEqual({id: 'e1', start: 'forkOut1', end: 'forkOut2'})
      expect(store._output.edges).toContain('e1')
    })

    it('should rebind importer to store after fork output merge', async () => {
      const winnerFork = makeFork(['forkOut1'])

      StoreFork.createFork.mockReturnValueOnce(winnerFork)
      CandidateEvaluator.validate.mockReturnValue({pass: true, reason: null})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 1, reason: null})

      const runner = jest.fn().mockResolvedValue()
      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})
      const importerBefore = store.importer

      await RefineNStrategy.execute(runner, store, 'parent', 'refine', 'prompt', 2, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(store.importer).not.toBe(importerBefore)
      expect(store.importer.store).toBe(store)
    })

    it('should select sole surviving fork when existing output fails structural gate', async () => {
      const winnerFork = makeFork(['forkOut1'])

      StoreFork.createFork.mockReturnValueOnce(winnerFork)
      CandidateEvaluator.validate
        .mockReturnValueOnce({pass: false, reason: 'empty_output'})
        .mockReturnValueOnce({pass: true, reason: null})

      const runner = jest.fn().mockResolvedValue()
      const store = makeStore([], {})

      await RefineNStrategy.execute(runner, store, 'parent', 'refine', 'prompt', 2, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(LLMJudge.evaluate).not.toHaveBeenCalled()
      expect(store._nodes.forkOut1).toBeDefined()
    })

    it('should skip judge when only one candidate survives structural gate', async () => {
      CandidateEvaluator.validate
        .mockReturnValueOnce({pass: true, reason: null})
        .mockReturnValueOnce({pass: false, reason: 'empty_output'})

      const runner = jest.fn().mockResolvedValue()
      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})

      await RefineNStrategy.execute(runner, store, 'parent', 'refine', 'prompt', 2, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(LLMJudge.evaluate).not.toHaveBeenCalled()
    })
  })

  describe('title suffix', () => {
    it('should write success suffix on refine node after selection', async () => {
      CandidateEvaluator.validate.mockReturnValue({pass: true, reason: null})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0, reason: null})

      const runner = jest.fn().mockResolvedValue()
      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})
      store._nodes.refine.title = '/refine'

      await RefineNStrategy.execute(runner, store, 'parent', 'refine', 'prompt', 3, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(store._nodes.refine.title).toMatch(/\[✓ \d+\/3 best of 3\]/)
    })

    it('should write failure suffix when all candidates fail structural gate', async () => {
      CandidateEvaluator.validate.mockReturnValue({pass: false, reason: 'empty_output'})

      const runner = jest.fn().mockResolvedValue()
      const store = makeStore([], {})
      store._nodes.refine.title = '/refine'

      await RefineNStrategy.execute(runner, store, 'parent', 'refine', 'prompt', 3, {})

      expect(store._nodes.refine.title).toBe('/refine [✗ 0/3 passed]')
    })

    it('should strip previous suffix before writing new one', async () => {
      CandidateEvaluator.validate.mockReturnValue({pass: true, reason: null})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0, reason: null})

      const runner = jest.fn().mockResolvedValue()
      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})
      store._nodes.refine.title = '/refine [✓ 2/3 best of 3]'

      await RefineNStrategy.execute(runner, store, 'parent', 'refine', 'prompt', 2, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(store._nodes.refine.title).not.toContain('[✓ 2/3 best of 3]')
      expect(store._nodes.refine.title).toContain('[✓')
    })
  })

  describe('criteria forwarding', () => {
    it('should forward criteria option to LLMJudge.evaluate', async () => {
      CandidateEvaluator.validate.mockReturnValue({pass: true, reason: null})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0, reason: null})

      const runner = jest.fn().mockResolvedValue()
      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})

      await RefineNStrategy.execute(runner, store, 'parent', 'refine', 'prompt', 2, {
        generatorFamily: 'OpenAI',
        settings: {},
        criteria: 'Must include revenue figures',
      })

      expect(LLMJudge.evaluate).toHaveBeenCalledWith(
        'prompt',
        expect.any(Array),
        'OpenAI',
        {},
        expect.objectContaining({criteria: 'Must include revenue figures'}),
      )
    })

    it('should pass undefined criteria when not provided', async () => {
      CandidateEvaluator.validate.mockReturnValue({pass: true, reason: null})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0, reason: null})

      const runner = jest.fn().mockResolvedValue()
      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})

      await RefineNStrategy.execute(runner, store, 'parent', 'refine', 'prompt', 2, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(LLMJudge.evaluate).toHaveBeenCalledWith(
        'prompt',
        expect.any(Array),
        'OpenAI',
        {},
        expect.objectContaining({criteria: undefined}),
      )
    })
  })

  describe('error resilience', () => {
    it('should count failed fork as non-candidate without throwing', async () => {
      StoreFork.createFork.mockReturnValue(makeFork())
      CandidateEvaluator.validate.mockReturnValueOnce({pass: true, reason: null})

      const runner = jest.fn().mockRejectedValue(new Error('LLM call failed'))
      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})

      await expect(
        RefineNStrategy.execute(runner, store, 'parent', 'refine', 'prompt', 2, {
          generatorFamily: 'OpenAI',
          settings: {},
        }),
      ).resolves.not.toThrow()

      expect(LLMJudge.evaluate).not.toHaveBeenCalled()
    })
  })
})

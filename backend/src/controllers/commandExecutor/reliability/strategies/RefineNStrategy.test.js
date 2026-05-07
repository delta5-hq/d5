import RefineNStrategy from './RefineNStrategy'
import StoreFork from '../core/StoreFork'
import CandidateEvaluator from '../core/CandidateEvaluator'
import LLMJudge from '../core/LLMJudge'
import Store from '../../commands/utils/Store'
import {
  buildCandidateSuffix,
  buildGateFailureSuffix,
  buildFirstSurvivorSuffix,
  REFINED_SUFFIX,
  REFINE_FAILURE_SUFFIX,
} from '../core/reliabilitySuffix'

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

  describe('candidate generation', () => {
    it('creates N-1 forks and runs the command N-1 times for N > 1', async () => {
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

    it('creates no forks and skips judge when N = 1', async () => {
      CandidateEvaluator.validate.mockReturnValue({pass: true, reason: null})
      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})

      await RefineNStrategy.execute(jest.fn(), store, 'parent', 'refine', 'prompt', 1, {})

      expect(StoreFork.createFork).not.toHaveBeenCalled()
      expect(LLMJudge.evaluate).not.toHaveBeenCalled()
    })

    it('passes the forked store to the runner, not the original', async () => {
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

  describe('gate filtering', () => {
    it('excludes existing output when it fails the structural gate', async () => {
      const winnerFork = makeFork(['forkOut1'])
      StoreFork.createFork.mockReturnValueOnce(winnerFork)
      CandidateEvaluator.validate
        .mockReturnValueOnce({pass: false, reason: 'empty_output'})
        .mockReturnValueOnce({pass: true, reason: null})

      const store = makeStore([], {})

      await RefineNStrategy.execute(jest.fn().mockResolvedValue(), store, 'parent', 'refine', 'prompt', 2, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(LLMJudge.evaluate).not.toHaveBeenCalled()
      expect(store._nodes.forkOut1).toBeDefined()
    })

    it('skips judge when only one candidate survives the gate', async () => {
      CandidateEvaluator.validate
        .mockReturnValueOnce({pass: true, reason: null})
        .mockReturnValueOnce({pass: false, reason: 'empty_output'})

      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})

      await RefineNStrategy.execute(jest.fn().mockResolvedValue(), store, 'parent', 'refine', 'prompt', 2, {})

      expect(LLMJudge.evaluate).not.toHaveBeenCalled()
    })
  })

  describe('winner selection', () => {
    it('keeps parent prompts unchanged when existing output wins', async () => {
      CandidateEvaluator.validate.mockReturnValue({pass: true, reason: null})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0, reason: null})

      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})
      const originalPrompts = [...store._nodes.parent.prompts]

      await RefineNStrategy.execute(jest.fn().mockResolvedValue(), store, 'parent', 'refine', 'prompt', 2, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(store._nodes.parent.prompts).toEqual(originalPrompts)
      expect(store._output.nodes).toEqual(['refine'])
      expect(store._output.edges).toEqual([])
    })

    it('merges fork output nodes into store when fork wins', async () => {
      const winnerFork = makeFork(['forkOut1'])
      StoreFork.createFork.mockReturnValueOnce(winnerFork)
      CandidateEvaluator.validate.mockReturnValue({pass: true, reason: null})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 1, reason: null})

      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})

      await RefineNStrategy.execute(jest.fn().mockResolvedValue(), store, 'parent', 'refine', 'prompt', 2, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(store._nodes.forkOut1).toBeDefined()
      expect(store._output.nodes).toContain('forkOut1')
      expect(store._output.nodes).toContain('refine')
      expect(store._nodes.parent.prompts).toEqual(['forkOut1'])
      expect(store._nodes.parent.children).toContain('refine')
      expect(store._nodes.parent.command).toBe('/claude analyse')
      expect(store._nodes.parent.title).toBe('Run analysis')
    })

    it('registers all output nodes when fork produces multiple', async () => {
      const winnerFork = makeFork(['forkOut1', 'forkOut2'])
      StoreFork.createFork.mockReturnValueOnce(winnerFork)
      CandidateEvaluator.validate.mockReturnValue({pass: true, reason: null})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 1, reason: null})

      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})

      await RefineNStrategy.execute(jest.fn().mockResolvedValue(), store, 'parent', 'refine', 'prompt', 2, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(store._output.nodes).toContain('forkOut1')
      expect(store._output.nodes).toContain('forkOut2')
      expect(store._nodes.forkOut1).toBeDefined()
      expect(store._nodes.forkOut2).toBeDefined()
    })

    it('merges fork output edges when fork wins', async () => {
      const winnerFork = makeFork(['forkOut1'], ['e1'])
      winnerFork._edges = {e1: {id: 'e1', start: 'forkOut1', end: 'forkOut2'}}
      StoreFork.createFork.mockReturnValueOnce(winnerFork)
      CandidateEvaluator.validate.mockReturnValue({pass: true, reason: null})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 1, reason: null})

      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})

      await RefineNStrategy.execute(jest.fn().mockResolvedValue(), store, 'parent', 'refine', 'prompt', 2, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(store._edges.e1).toEqual({id: 'e1', start: 'forkOut1', end: 'forkOut2'})
      expect(store._output.edges).toContain('e1')
    })

    it('rebinds importer to store after fork output merge', async () => {
      const winnerFork = makeFork(['forkOut1'])
      StoreFork.createFork.mockReturnValueOnce(winnerFork)
      CandidateEvaluator.validate.mockReturnValue({pass: true, reason: null})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 1, reason: null})

      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})
      const importerBefore = store.importer

      await RefineNStrategy.execute(jest.fn().mockResolvedValue(), store, 'parent', 'refine', 'prompt', 2, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(store.importer).not.toBe(importerBefore)
      expect(store.importer.store).toBe(store)
    })
  })

  describe('title annotation', () => {
    it('writes candidate suffix on refine node after successful judgment', async () => {
      CandidateEvaluator.validate.mockReturnValue({pass: true, reason: null})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0, reason: null})

      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})
      store._nodes.refine.title = '/refine'

      await RefineNStrategy.execute(jest.fn().mockResolvedValue(), store, 'parent', 'refine', 'prompt', 3, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(store._nodes.refine.title).toBe(`/refine ${buildCandidateSuffix(3, 3)}`)
      expect(store._output.nodes).toContain('refine')
    })

    it('writes candidate suffix with accurate pass fraction when some candidates fail gate', async () => {
      CandidateEvaluator.validate
        .mockReturnValueOnce({pass: true, reason: null})
        .mockReturnValueOnce({pass: false, reason: 'empty'})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0, reason: null})

      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})
      store._nodes.refine.title = '/refine'

      await RefineNStrategy.execute(jest.fn().mockResolvedValue(), store, 'parent', 'refine', 'prompt', 2, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(store._nodes.refine.title).toBe(`/refine ${buildCandidateSuffix(1, 2)}`)
    })

    it('writes gate failure suffix when all candidates fail the gate', async () => {
      CandidateEvaluator.validate.mockReturnValue({pass: false, reason: 'empty_output'})

      const store = makeStore([], {})
      store._nodes.refine.title = '/refine'

      await RefineNStrategy.execute(jest.fn().mockResolvedValue(), store, 'parent', 'refine', 'prompt', 3, {})

      expect(store._nodes.refine.title).toBe(`/refine ${buildGateFailureSuffix(3)}`)
      expect(store._output.nodes).toContain('refine')
    })

    it('writes candidate suffix for N=1 using existing output as sole candidate', async () => {
      CandidateEvaluator.validate.mockReturnValue({pass: true, reason: null})

      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})
      store._nodes.refine.title = '/refine'

      await RefineNStrategy.execute(jest.fn(), store, 'parent', 'refine', 'prompt', 1, {})

      expect(store._nodes.refine.title).toBe(`/refine ${buildCandidateSuffix(1, 1)}`)
      expect(store._output.nodes).toContain('refine')
    })

    it.each([
      ['no_alternative_model_available', 'no_alternative_model_available'],
      ['judge_invocation_failed', 'judge_invocation_failed'],
      ['unparseable_judge_response', 'unparseable_judge_response'],
    ])('writes first-survivor suffix when judge returns reason "%s"', async (_label, reason) => {
      CandidateEvaluator.validate.mockReturnValue({pass: true, reason: null})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0, reason})

      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})
      store._nodes.refine.title = '/refine'

      await RefineNStrategy.execute(jest.fn().mockResolvedValue(), store, 'parent', 'refine', 'prompt', 3, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(store._nodes.refine.title).toBe(`/refine ${buildFirstSurvivorSuffix(3, 3)}`)
      expect(store._output.nodes).toContain('refine')
    })

    it.each([
      ['candidate suffix', buildCandidateSuffix(2, 3)],
      ['gate failure suffix', buildGateFailureSuffix(5)],
      ['first-survivor suffix', buildFirstSurvivorSuffix(2, 3)],
      ['REFINED_SUFFIX', REFINED_SUFFIX],
      ['REFINE_FAILURE_SUFFIX', REFINE_FAILURE_SUFFIX],
    ])('strips %s from prior execution before writing new suffix', async (_label, priorSuffix) => {
      CandidateEvaluator.validate.mockReturnValue({pass: true, reason: null})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0, reason: null})

      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})
      store._nodes.refine.title = `/refine ${priorSuffix}`

      await RefineNStrategy.execute(jest.fn().mockResolvedValue(), store, 'parent', 'refine', 'prompt', 3, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(store._nodes.refine.title).toBe(`/refine ${buildCandidateSuffix(3, 3)}`)
    })

    it('always writes suffix and registers refine node even when all candidates fail gate', async () => {
      CandidateEvaluator.validate.mockReturnValue({pass: false, reason: 'empty_output'})

      const store = makeStore([], {})

      await RefineNStrategy.execute(jest.fn().mockResolvedValue(), store, 'parent', 'refine', 'prompt', 2, {})

      expect(store._output.nodes).toContain('refine')
      expect(store._nodes.refine.title).toContain('[✗')
    })

    it('handles absent refineNode without throwing', async () => {
      CandidateEvaluator.validate.mockReturnValue({pass: true, reason: null})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0, reason: null})

      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})
      delete store._nodes.refine

      await expect(
        RefineNStrategy.execute(jest.fn().mockResolvedValue(), store, 'parent', 'refine', 'prompt', 2, {
          generatorFamily: 'OpenAI',
          settings: {},
        }),
      ).resolves.not.toThrow()
    })
  })

  describe('criteria forwarding', () => {
    it('forwards criteria to the judge', async () => {
      CandidateEvaluator.validate.mockReturnValue({pass: true, reason: null})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0, reason: null})

      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})

      await RefineNStrategy.execute(jest.fn().mockResolvedValue(), store, 'parent', 'refine', 'prompt', 2, {
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

    it('forwards undefined criteria when option is absent', async () => {
      CandidateEvaluator.validate.mockReturnValue({pass: true, reason: null})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0, reason: null})

      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})

      await RefineNStrategy.execute(jest.fn().mockResolvedValue(), store, 'parent', 'refine', 'prompt', 2, {
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

    it('forwards empty string criteria — distinct from absent criteria', async () => {
      CandidateEvaluator.validate.mockReturnValue({pass: true, reason: null})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0, reason: null})

      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})

      await RefineNStrategy.execute(jest.fn().mockResolvedValue(), store, 'parent', 'refine', 'prompt', 2, {
        generatorFamily: 'OpenAI',
        settings: {},
        criteria: '',
      })

      expect(LLMJudge.evaluate).toHaveBeenCalledWith(
        'prompt',
        expect.any(Array),
        'OpenAI',
        {},
        expect.objectContaining({criteria: ''}),
      )
    })
  })

  describe('error resilience', () => {
    it('counts a throwing fork runner as a non-candidate without propagating', async () => {
      StoreFork.createFork.mockReturnValue(makeFork())
      CandidateEvaluator.validate.mockReturnValueOnce({pass: true, reason: null})

      const store = makeStore(['existingOut'], {existingOut: {id: 'existingOut', title: 'Existing'}})

      await expect(
        RefineNStrategy.execute(
          jest.fn().mockRejectedValue(new Error('LLM call failed')),
          store,
          'parent',
          'refine',
          'prompt',
          2,
          {generatorFamily: 'OpenAI', settings: {}},
        ),
      ).resolves.not.toThrow()

      expect(LLMJudge.evaluate).not.toHaveBeenCalled()
    })
  })
})

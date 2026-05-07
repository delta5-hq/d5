import BestOfNStrategy from './BestOfNStrategy'
import StoreFork from '../core/StoreFork'
import LLMJudge from '../core/LLMJudge'
import CandidateEvaluator from '../core/CandidateEvaluator'
import {
  buildCandidateSuffix,
  buildGateFailureSuffix,
  buildFirstSurvivorSuffix,
  REFINED_SUFFIX,
  REFINE_FAILURE_SUFFIX,
} from '../core/reliabilitySuffix'

jest.mock('../core/StoreFork')
jest.mock('../core/LLMJudge')
jest.mock('../core/CandidateEvaluator')

describe('BestOfNStrategy', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('parallel candidate generation', () => {
    it('runs N commands on N isolated forks', async () => {
      const forks = [{}, {}, {}]
      let idx = 0
      StoreFork.createFork.mockImplementation(() => forks[idx++])
      CandidateEvaluator.validate.mockReturnValue({pass: true})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0, reason: null})
      StoreFork.applyCandidate.mockImplementation(() => {})

      const executor = jest.fn()
      await BestOfNStrategy.execute(executor, {}, 'c1', 'prompt', 3, {})

      expect(executor).toHaveBeenCalledTimes(3)
      expect(executor).toHaveBeenNthCalledWith(1, forks[0])
      expect(executor).toHaveBeenNthCalledWith(2, forks[1])
      expect(executor).toHaveBeenNthCalledWith(3, forks[2])
    })

    it('runs all N candidates in parallel, not serially', async () => {
      StoreFork.createFork.mockImplementation(() => ({}))
      CandidateEvaluator.validate.mockReturnValue({pass: true})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0, reason: null})
      StoreFork.applyCandidate.mockImplementation(() => {})

      const executor = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 10)))

      const start = Date.now()
      await BestOfNStrategy.execute(executor, {}, 'c1', 'prompt', 3, {})
      expect(Date.now() - start).toBeLessThan(50)
    })

    it('treats a throwing executor as a failed candidate without propagating', async () => {
      const forks = [{}, {}]
      let idx = 0
      StoreFork.createFork.mockImplementation(() => forks[idx++])
      const executor = jest.fn().mockRejectedValueOnce(new Error('LLM error')).mockResolvedValueOnce(undefined)
      CandidateEvaluator.validate.mockReturnValue({pass: true})
      StoreFork.applyCandidate.mockImplementation(() => {})

      await BestOfNStrategy.execute(executor, {}, 'c1', 'prompt', 2, {})

      expect(executor).toHaveBeenCalledTimes(2)
      expect(StoreFork.applyCandidate).toHaveBeenCalledWith(expect.anything(), forks[1], 'c1')
    })

    it('collects only fulfilled and validated candidates from mixed-outcome runs', async () => {
      const forks = Array.from({length: 5}, (_, i) => ({id: i}))
      let idx = 0
      StoreFork.createFork.mockImplementation(() => forks[idx++])

      const executor = jest
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(undefined)

      CandidateEvaluator.validate
        .mockReturnValueOnce({pass: true})
        .mockReturnValueOnce({pass: false})
        .mockReturnValueOnce({pass: true})

      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0, reason: null})
      StoreFork.applyCandidate.mockImplementation(() => {})

      await BestOfNStrategy.execute(executor, {}, 'c1', 'prompt', 5, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(LLMJudge.evaluate).toHaveBeenCalledWith(
        'prompt',
        [forks[1], forks[4]],
        'OpenAI',
        {},
        expect.objectContaining({criteria: undefined}),
      )
    })
  })

  describe('gate filtering', () => {
    it('passes only gate-passing candidates to the judge', async () => {
      const forks = [{}, {}, {}]
      let idx = 0
      StoreFork.createFork.mockImplementation(() => forks[idx++])
      CandidateEvaluator.validate
        .mockReturnValueOnce({pass: false})
        .mockReturnValueOnce({pass: true})
        .mockReturnValueOnce({pass: true})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0, reason: null})
      StoreFork.applyCandidate.mockImplementation(() => {})

      await BestOfNStrategy.execute(jest.fn(), {}, 'c1', 'prompt', 3, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(LLMJudge.evaluate).toHaveBeenCalledWith(
        'prompt',
        [forks[1], forks[2]],
        'OpenAI',
        {},
        expect.objectContaining({criteria: undefined}),
      )
    })

    it('skips judge and applies sole survivor directly', async () => {
      const fork = {}
      StoreFork.createFork.mockReturnValue(fork)
      CandidateEvaluator.validate
        .mockReturnValueOnce({pass: true})
        .mockReturnValueOnce({pass: false})
        .mockReturnValueOnce({pass: false})
      StoreFork.applyCandidate.mockImplementation(() => {})

      await BestOfNStrategy.execute(jest.fn(), {}, 'c1', 'prompt', 3, {})

      expect(LLMJudge.evaluate).not.toHaveBeenCalled()
      expect(StoreFork.applyCandidate).toHaveBeenCalledWith(expect.anything(), fork, 'c1')
    })

    it('resolves without throwing when all candidates fail the gate', async () => {
      StoreFork.createFork.mockReturnValue({})
      CandidateEvaluator.validate.mockReturnValue({pass: false})

      await expect(BestOfNStrategy.execute(jest.fn(), {}, 'c1', 'prompt', 3, {})).resolves.toBeUndefined()
    })

    it('does not apply any candidate when all fail the gate', async () => {
      StoreFork.createFork.mockReturnValue({})
      CandidateEvaluator.validate.mockReturnValue({pass: false})

      await BestOfNStrategy.execute(jest.fn(), {}, 'c1', 'prompt', 3, {})

      expect(StoreFork.applyCandidate).not.toHaveBeenCalled()
    })
  })

  describe('winner selection', () => {
    it('applies the judge-selected winner to the original store', async () => {
      const forks = [{}, {}]
      let idx = 0
      StoreFork.createFork.mockImplementation(() => forks[idx++])
      CandidateEvaluator.validate.mockReturnValue({pass: true})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 1, reason: null})
      StoreFork.applyCandidate.mockImplementation(() => {})

      const store = {}
      await BestOfNStrategy.execute(jest.fn(), store, 'c1', 'prompt', 2, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(StoreFork.applyCandidate).toHaveBeenCalledWith(store, forks[1], 'c1')
    })

    it('applies the sole survivor when judge is bypassed (N=1)', async () => {
      const fork = {}
      StoreFork.createFork.mockReturnValue(fork)
      CandidateEvaluator.validate.mockReturnValue({pass: true})
      StoreFork.applyCandidate.mockImplementation(() => {})

      const store = {}
      await BestOfNStrategy.execute(jest.fn(), store, 'c1', 'prompt', 1, {})

      expect(StoreFork.applyCandidate).toHaveBeenCalledWith(store, fork, 'c1')
    })
  })

  describe('title annotation', () => {
    it('writes candidate suffix with accurate pass fraction after judgment', async () => {
      const store = {_nodes: {c1: {id: 'c1', title: 'T'}}}
      const forks = [{}, {}, {}]
      let idx = 0
      StoreFork.createFork.mockImplementation(() => forks[idx++])
      CandidateEvaluator.validate
        .mockReturnValueOnce({pass: true})
        .mockReturnValueOnce({pass: false})
        .mockReturnValueOnce({pass: true})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0, reason: null})
      StoreFork.applyCandidate.mockImplementation(() => {})

      await BestOfNStrategy.execute(jest.fn(), store, 'c1', 'prompt', 3, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(store._nodes.c1.title).toBe(`T ${buildCandidateSuffix(2, 3)}`)
    })

    it('writes gate failure suffix and resolves when all candidates fail', async () => {
      const store = {_nodes: {c1: {id: 'c1', title: 'T'}}}
      StoreFork.createFork.mockReturnValue({})
      CandidateEvaluator.validate.mockReturnValue({pass: false})

      await BestOfNStrategy.execute(jest.fn(), store, 'c1', 'prompt', 3, {})

      expect(store._nodes.c1.title).toBe(`T ${buildGateFailureSuffix(3)}`)
    })

    it('writes candidate suffix for sole survivor (N=1 judge bypass)', async () => {
      const store = {_nodes: {c1: {id: 'c1', title: 'T'}}}
      StoreFork.createFork.mockReturnValue({})
      CandidateEvaluator.validate.mockReturnValue({pass: true})
      StoreFork.applyCandidate.mockImplementation(() => {})

      await BestOfNStrategy.execute(jest.fn(), store, 'c1', 'prompt', 1, {})

      expect(store._nodes.c1.title).toBe(`T ${buildCandidateSuffix(1, 1)}`)
    })

    it.each([
      ['candidate suffix', buildCandidateSuffix(2, 2)],
      ['gate failure suffix', buildGateFailureSuffix(5)],
      ['first-survivor suffix', buildFirstSurvivorSuffix(2, 3)],
      ['REFINED_SUFFIX', REFINED_SUFFIX],
      ['REFINE_FAILURE_SUFFIX', REFINE_FAILURE_SUFFIX],
    ])('strips %s from prior execution before writing new suffix', async (_label, priorSuffix) => {
      const store = {
        _nodes: {c1: {id: 'c1', title: `Base ${priorSuffix}`}},
      }
      StoreFork.createFork.mockReturnValue({})
      CandidateEvaluator.validate.mockReturnValue({pass: true})
      StoreFork.applyCandidate.mockImplementation(() => {})

      await BestOfNStrategy.execute(jest.fn(), store, 'c1', 'prompt', 1, {})

      expect(store._nodes.c1.title).toBe(`Base ${buildCandidateSuffix(1, 1)}`)
    })

    it.each([
      ['no_alternative_model_available', 'no_alternative_model_available'],
      ['judge_invocation_failed', 'judge_invocation_failed'],
      ['unparseable_judge_response', 'unparseable_judge_response'],
    ])('writes first-survivor suffix when judge returns reason "%s"', async (_label, reason) => {
      const store = {_nodes: {c1: {id: 'c1', title: 'T'}}}
      const forks = [{}, {}]
      let idx = 0
      StoreFork.createFork.mockImplementation(() => forks[idx++])
      CandidateEvaluator.validate.mockReturnValue({pass: true})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0, reason})
      StoreFork.applyCandidate.mockImplementation(() => {})

      await BestOfNStrategy.execute(jest.fn(), store, 'c1', 'prompt', 2, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(store._nodes.c1.title).toBe(`T ${buildFirstSurvivorSuffix(2, 2)}`)
    })

    it('handles absent store._nodes without throwing', async () => {
      StoreFork.createFork.mockReturnValue({})
      CandidateEvaluator.validate.mockReturnValue({pass: true})
      StoreFork.applyCandidate.mockImplementation(() => {})

      await expect(BestOfNStrategy.execute(jest.fn(), {}, 'c1', 'prompt', 1, {})).resolves.not.toThrow()
    })

    it('handles absent cellId in store._nodes without throwing', async () => {
      const store = {_nodes: {}}
      StoreFork.createFork.mockReturnValue({})
      CandidateEvaluator.validate.mockReturnValue({pass: true})
      StoreFork.applyCandidate.mockImplementation(() => {})

      await expect(BestOfNStrategy.execute(jest.fn(), store, 'missing', 'prompt', 1, {})).resolves.not.toThrow()
      expect(store._nodes.missing).toBeUndefined()
    })
  })

  describe('criteria forwarding', () => {
    it('forwards criteria to the judge', async () => {
      const forks = [{}, {}]
      let idx = 0
      StoreFork.createFork.mockImplementation(() => forks[idx++])
      CandidateEvaluator.validate.mockReturnValue({pass: true})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0, reason: null})
      StoreFork.applyCandidate.mockImplementation(() => {})

      await BestOfNStrategy.execute(jest.fn(), {}, 'c1', 'prompt', 2, {
        generatorFamily: 'OpenAI',
        settings: {},
        criteria: 'Must include revenue figures',
      })

      expect(LLMJudge.evaluate).toHaveBeenCalledWith(
        'prompt',
        [forks[0], forks[1]],
        'OpenAI',
        {},
        expect.objectContaining({criteria: 'Must include revenue figures'}),
      )
    })

    it('forwards undefined criteria when option is absent', async () => {
      const forks = [{}, {}]
      let idx = 0
      StoreFork.createFork.mockImplementation(() => forks[idx++])
      CandidateEvaluator.validate.mockReturnValue({pass: true})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0, reason: null})
      StoreFork.applyCandidate.mockImplementation(() => {})

      await BestOfNStrategy.execute(jest.fn(), {}, 'c1', 'prompt', 2, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(LLMJudge.evaluate).toHaveBeenCalledWith(
        'prompt',
        [forks[0], forks[1]],
        'OpenAI',
        {},
        expect.objectContaining({criteria: undefined}),
      )
    })

    it('forwards empty string criteria — distinct from absent criteria', async () => {
      const forks = [{}, {}]
      let idx = 0
      StoreFork.createFork.mockImplementation(() => forks[idx++])
      CandidateEvaluator.validate.mockReturnValue({pass: true})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0, reason: null})
      StoreFork.applyCandidate.mockImplementation(() => {})

      await BestOfNStrategy.execute(jest.fn(), {}, 'c1', 'prompt', 2, {
        generatorFamily: 'OpenAI',
        settings: {},
        criteria: '',
      })

      expect(LLMJudge.evaluate).toHaveBeenCalledWith(
        'prompt',
        [forks[0], forks[1]],
        'OpenAI',
        {},
        expect.objectContaining({criteria: ''}),
      )
    })
  })
})

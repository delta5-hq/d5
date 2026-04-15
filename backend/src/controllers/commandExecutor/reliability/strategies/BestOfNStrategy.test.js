import BestOfNStrategy from './BestOfNStrategy'
import StoreFork from '../core/StoreFork'
import LLMJudge from '../core/LLMJudge'
import CandidateEvaluator from '../core/CandidateEvaluator'

jest.mock('../core/StoreFork')
jest.mock('../core/LLMJudge')
jest.mock('../core/CandidateEvaluator')

describe('BestOfNStrategy', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('execute', () => {
    it('should execute command N times on separate forks', async () => {
      const store = {_userId: 'user1'}
      const forks = [
        {getOutput: () => ({nodes: [{title: 'F1'}], edges: []})},
        {getOutput: () => ({nodes: [{title: 'F2'}], edges: []})},
        {getOutput: () => ({nodes: [{title: 'F3'}], edges: []})},
      ]

      let forkIndex = 0
      StoreFork.createFork.mockImplementation(() => forks[forkIndex++])
      CandidateEvaluator.validate.mockReturnValue({pass: true})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 1})
      StoreFork.applyCandidate.mockImplementation(() => {})

      const executor = jest.fn()

      await BestOfNStrategy.execute(executor, store, 'cell1', 'prompt', 3, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(executor).toHaveBeenCalledTimes(3)
      expect(executor).toHaveBeenNthCalledWith(1, forks[0])
      expect(executor).toHaveBeenNthCalledWith(2, forks[1])
      expect(executor).toHaveBeenNthCalledWith(3, forks[2])
    })

    it('should filter out candidates that fail structural validation', async () => {
      const forks = [{}, {}, {}]
      let forkIndex = 0
      StoreFork.createFork.mockImplementation(() => forks[forkIndex++])

      CandidateEvaluator.validate
        .mockReturnValueOnce({pass: false, reason: 'empty'})
        .mockReturnValueOnce({pass: true})
        .mockReturnValueOnce({pass: true})

      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0})
      StoreFork.applyCandidate.mockImplementation(() => {})

      const executor = jest.fn()

      await BestOfNStrategy.execute(executor, {}, 'cell1', 'prompt', 3, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(LLMJudge.evaluate).toHaveBeenCalledWith('prompt', [forks[1], forks[2]], 'OpenAI', {})
    })

    it('should skip judge when only one candidate survives', async () => {
      const fork = {}
      StoreFork.createFork.mockReturnValue(fork)

      CandidateEvaluator.validate
        .mockReturnValueOnce({pass: true})
        .mockReturnValueOnce({pass: false})
        .mockReturnValueOnce({pass: false})

      StoreFork.applyCandidate.mockImplementation(() => {})

      const executor = jest.fn()

      await BestOfNStrategy.execute(executor, {}, 'cell1', 'prompt', 3, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(LLMJudge.evaluate).not.toHaveBeenCalled()
      expect(StoreFork.applyCandidate).toHaveBeenCalledWith(expect.anything(), fork, 'cell1')
    })

    it('should throw when all candidates fail', async () => {
      StoreFork.createFork.mockReturnValue({})
      CandidateEvaluator.validate.mockReturnValue({pass: false})

      const executor = jest.fn()

      await expect(
        BestOfNStrategy.execute(executor, {}, 'cell1', 'prompt', 3, {
          generatorFamily: 'OpenAI',
          settings: {},
        }),
      ).rejects.toThrow('All candidates failed structural validation')
    })

    it('should handle executor exceptions and continue', async () => {
      const forks = [{}, {}]
      let forkIndex = 0
      StoreFork.createFork.mockImplementation(() => forks[forkIndex++])

      const executor = jest.fn().mockRejectedValueOnce(new Error('Fail')).mockResolvedValueOnce(undefined)

      CandidateEvaluator.validate.mockReturnValue({pass: true})
      StoreFork.applyCandidate.mockImplementation(() => {})

      await BestOfNStrategy.execute(executor, {}, 'cell1', 'prompt', 2, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(executor).toHaveBeenCalledTimes(2)
      expect(StoreFork.applyCandidate).toHaveBeenCalledWith(expect.anything(), forks[1], 'cell1')
    })

    it('should apply winner to original store', async () => {
      const originalStore = {}
      const winnerFork = {}

      StoreFork.createFork.mockReturnValue(winnerFork)
      CandidateEvaluator.validate.mockReturnValue({pass: true})
      StoreFork.applyCandidate.mockImplementation(() => {})

      const executor = jest.fn()

      await BestOfNStrategy.execute(executor, originalStore, 'cell1', 'prompt', 1, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(StoreFork.applyCandidate).toHaveBeenCalledWith(originalStore, winnerFork, 'cell1')
    })

    it('should execute candidates in parallel', async () => {
      const executionTimestamps = []
      const forks = [{}, {}, {}]
      let forkIndex = 0

      StoreFork.createFork.mockImplementation(() => forks[forkIndex++])
      CandidateEvaluator.validate.mockReturnValue({pass: true})
      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0})
      StoreFork.applyCandidate.mockImplementation(() => {})

      const executor = jest.fn().mockImplementation(async fork => {
        const startTime = Date.now()
        executionTimestamps.push({fork, startTime})
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      const start = Date.now()
      await BestOfNStrategy.execute(executor, {}, 'cell1', 'prompt', 3, {
        generatorFamily: 'OpenAI',
        settings: {},
      })
      const duration = Date.now() - start

      expect(executor).toHaveBeenCalledTimes(3)
      expect(duration).toBeLessThan(50)
    })

    it('should handle Promise.allSettled with mixed outcomes', async () => {
      const forks = [{id: 1}, {id: 2}, {id: 3}, {id: 4}]
      let forkIndex = 0

      StoreFork.createFork.mockImplementation(() => forks[forkIndex++])

      const executor = jest
        .fn()
        .mockRejectedValueOnce(new Error('Executor fail'))
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Executor fail'))
        .mockResolvedValueOnce(undefined)

      CandidateEvaluator.validate.mockReturnValueOnce({pass: true}).mockReturnValueOnce({pass: false})

      StoreFork.applyCandidate.mockImplementation(() => {})

      await BestOfNStrategy.execute(executor, {}, 'cell1', 'prompt', 4, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(executor).toHaveBeenCalledTimes(4)
      expect(StoreFork.applyCandidate).toHaveBeenCalledWith(expect.anything(), forks[1], 'cell1')
    })

    it('should collect only fulfilled and validated candidates', async () => {
      const forks = Array.from({length: 5}, (_, i) => ({id: i}))
      let forkIndex = 0

      StoreFork.createFork.mockImplementation(() => forks[forkIndex++])

      const executor = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce(undefined)

      CandidateEvaluator.validate
        .mockReturnValueOnce({pass: true})
        .mockReturnValueOnce({pass: false})
        .mockReturnValueOnce({pass: true})

      LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0})
      StoreFork.applyCandidate.mockImplementation(() => {})

      await BestOfNStrategy.execute(executor, {}, 'cell1', 'prompt', 5, {
        generatorFamily: 'OpenAI',
        settings: {},
      })

      expect(LLMJudge.evaluate).toHaveBeenCalledWith('prompt', [forks[1], forks[4]], 'OpenAI', {})
    })
  })
})

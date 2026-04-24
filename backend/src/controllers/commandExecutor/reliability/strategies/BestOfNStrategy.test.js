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

      expect(LLMJudge.evaluate).toHaveBeenCalledWith(
        'prompt',
        [forks[1], forks[2]],
        'OpenAI',
        {},
        {criteria: undefined},
      )
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

      expect(LLMJudge.evaluate).toHaveBeenCalledWith(
        'prompt',
        [forks[1], forks[4]],
        'OpenAI',
        {},
        {criteria: undefined},
      )
    })
  })
  describe('store mutation', () => {
    describe('title annotation', () => {
      it('should annotate cell title with execution summary when store has _nodes', async () => {
        const store = {
          _userId: 'user1',
          _nodes: {
            cell1: {id: 'cell1', title: 'Original'},
          },
        }
        const forks = [{}, {}, {}]
        let forkIndex = 0

        StoreFork.createFork.mockImplementation(() => forks[forkIndex++])
        CandidateEvaluator.validate.mockReturnValue({pass: true})
        LLMJudge.evaluate.mockResolvedValue({winnerIndex: 1})
        StoreFork.applyCandidate.mockImplementation(() => {})

        await BestOfNStrategy.execute(jest.fn(), store, 'cell1', 'prompt', 3, {
          generatorFamily: 'OpenAI',
          settings: {},
        })

        expect(store._nodes.cell1.title).toMatch(/Original/)
        expect(store._nodes.cell1.title).toMatch(/\[✓ \d+\/\d+ best of \d+\]/)
      })

      it('should annotate with pass count matching validated candidates', async () => {
        const store = {
          _userId: 'user1',
          _nodes: {
            cell1: {id: 'cell1', title: 'T'},
          },
        }
        const forks = [{}, {}, {}]
        let forkIndex = 0

        StoreFork.createFork.mockImplementation(() => forks[forkIndex++])
        CandidateEvaluator.validate
          .mockReturnValueOnce({pass: true})
          .mockReturnValueOnce({pass: false})
          .mockReturnValueOnce({pass: true})
        LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0})
        StoreFork.applyCandidate.mockImplementation(() => {})

        await BestOfNStrategy.execute(jest.fn(), store, 'cell1', 'prompt', 3, {
          generatorFamily: 'OpenAI',
          settings: {},
        })

        expect(store._nodes.cell1.title).toBe('T [✓ 2/3 best of 3]')
      })

      it('should annotate failure when all candidates rejected by validator', async () => {
        const store = {
          _nodes: {
            cell1: {id: 'cell1', title: 'T'},
          },
        }

        StoreFork.createFork.mockReturnValue({})
        CandidateEvaluator.validate.mockReturnValue({pass: false})

        await expect(
          BestOfNStrategy.execute(jest.fn(), store, 'cell1', 'prompt', 3, {
            generatorFamily: 'OpenAI',
            settings: {},
          }),
        ).rejects.toThrow()

        expect(store._nodes.cell1.title).toBe('T [✗ 0/3 passed]')
      })

      it('should preserve idempotency by stripping prior annotation', async () => {
        const store = {
          _userId: 'user1',
          _nodes: {
            cell1: {id: 'cell1', title: 'Base [✓ 2/2 best of 2]'},
          },
        }
        const fork = {}

        StoreFork.createFork.mockReturnValue(fork)
        CandidateEvaluator.validate.mockReturnValue({pass: true})
        StoreFork.applyCandidate.mockImplementation(() => {})

        await BestOfNStrategy.execute(jest.fn(), store, 'cell1', 'prompt', 1, {
          generatorFamily: 'OpenAI',
          settings: {},
        })

        expect(store._nodes.cell1.title).toBe('Base [✓ 1/1 best of 1]')
      })

      it('should strip failure annotations before re-execution', async () => {
        const store = {
          _userId: 'user1',
          _nodes: {
            cell1: {id: 'cell1', title: 'Base [✗ 0/5 passed]'},
          },
        }
        const fork = {}

        StoreFork.createFork.mockReturnValue(fork)
        CandidateEvaluator.validate.mockReturnValue({pass: true})
        StoreFork.applyCandidate.mockImplementation(() => {})

        await BestOfNStrategy.execute(jest.fn(), store, 'cell1', 'prompt', 1, {
          generatorFamily: 'OpenAI',
          settings: {},
        })

        expect(store._nodes.cell1.title).toBe('Base [✓ 1/1 best of 1]')
      })

      it('should not mutate when single survivor bypasses judge', async () => {
        const store = {
          _userId: 'user1',
          _nodes: {
            cell1: {id: 'cell1', title: 'T'},
          },
        }
        const fork = {}

        StoreFork.createFork.mockReturnValue(fork)
        CandidateEvaluator.validate
          .mockReturnValueOnce({pass: true})
          .mockReturnValueOnce({pass: false})
          .mockReturnValueOnce({pass: false})
        StoreFork.applyCandidate.mockImplementation(() => {})

        await BestOfNStrategy.execute(jest.fn(), store, 'cell1', 'prompt', 3, {
          generatorFamily: 'OpenAI',
          settings: {},
        })

        expect(LLMJudge.evaluate).not.toHaveBeenCalled()
        expect(store._nodes.cell1.title).toBe('T [✓ 1/3 best of 3]')
      })

      it('should handle missing store._nodes gracefully', async () => {
        const store = {_userId: 'user1'}
        const fork = {}

        StoreFork.createFork.mockReturnValue(fork)
        CandidateEvaluator.validate.mockReturnValue({pass: true})
        StoreFork.applyCandidate.mockImplementation(() => {})

        await expect(
          BestOfNStrategy.execute(jest.fn(), store, 'cell1', 'prompt', 1, {
            generatorFamily: 'OpenAI',
            settings: {},
          }),
        ).resolves.not.toThrow()

        expect(store._nodes).toBeUndefined()
      })

      it('should handle missing cellId in store._nodes gracefully', async () => {
        const store = {
          _userId: 'user1',
          _nodes: {},
        }
        const fork = {}

        StoreFork.createFork.mockReturnValue(fork)
        CandidateEvaluator.validate.mockReturnValue({pass: true})
        StoreFork.applyCandidate.mockImplementation(() => {})

        await expect(
          BestOfNStrategy.execute(jest.fn(), store, 'missing', 'prompt', 1, {
            generatorFamily: 'OpenAI',
            settings: {},
          }),
        ).resolves.not.toThrow()

        expect(store._nodes.missing).toBeUndefined()
      })
    })

    describe('criteria forwarding', () => {
      it('should forward criteria option to LLMJudge.evaluate', async () => {
        const forks = [{}, {}]
        let forkIndex = 0
        StoreFork.createFork.mockImplementation(() => forks[forkIndex++])
        CandidateEvaluator.validate.mockReturnValue({pass: true})
        LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0})
        StoreFork.applyCandidate.mockImplementation(() => {})

        const executor = jest.fn()
        const criteria = 'Check grammar and spelling'

        await BestOfNStrategy.execute(executor, {}, 'cell1', 'prompt', 2, {
          generatorFamily: 'OpenAI',
          settings: {},
          criteria,
        })

        expect(LLMJudge.evaluate).toHaveBeenCalledWith('prompt', [forks[0], forks[1]], 'OpenAI', {}, {criteria})
      })

      it('should pass undefined criteria when option omitted', async () => {
        const forks = [{}, {}]
        let forkIndex = 0
        StoreFork.createFork.mockImplementation(() => forks[forkIndex++])
        CandidateEvaluator.validate.mockReturnValue({pass: true})
        LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0})
        StoreFork.applyCandidate.mockImplementation(() => {})

        const executor = jest.fn()

        await BestOfNStrategy.execute(executor, {}, 'cell1', 'prompt', 2, {
          generatorFamily: 'OpenAI',
          settings: {},
        })

        expect(LLMJudge.evaluate).toHaveBeenCalledWith(
          'prompt',
          [forks[0], forks[1]],
          'OpenAI',
          {},
          {criteria: undefined},
        )
      })

      it('should forward empty string criteria', async () => {
        const forks = [{}, {}]
        let forkIndex = 0
        StoreFork.createFork.mockImplementation(() => forks[forkIndex++])
        CandidateEvaluator.validate.mockReturnValue({pass: true})
        LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0})
        StoreFork.applyCandidate.mockImplementation(() => {})

        const executor = jest.fn()

        await BestOfNStrategy.execute(executor, {}, 'cell1', 'prompt', 2, {
          generatorFamily: 'OpenAI',
          settings: {},
          criteria: '',
        })

        expect(LLMJudge.evaluate).toHaveBeenCalledWith('prompt', [forks[0], forks[1]], 'OpenAI', {}, {criteria: ''})
      })

      it('should forward multi-segment criteria joined from multiple /validate nodes', async () => {
        const forks = [{}, {}]
        let forkIndex = 0
        StoreFork.createFork.mockImplementation(() => forks[forkIndex++])
        CandidateEvaluator.validate.mockReturnValue({pass: true})
        LLMJudge.evaluate.mockResolvedValue({winnerIndex: 0})
        StoreFork.applyCandidate.mockImplementation(() => {})

        const executor = jest.fn()
        const multiSegmentCriteria = 'Check grammar\n\nEnsure JSON output\n\nVerify all fields present'

        await BestOfNStrategy.execute(executor, {}, 'cell1', 'prompt', 2, {
          generatorFamily: 'OpenAI',
          settings: {},
          criteria: multiSegmentCriteria,
        })

        expect(LLMJudge.evaluate).toHaveBeenCalledWith(
          'prompt',
          [forks[0], forks[1]],
          'OpenAI',
          {},
          {criteria: multiSegmentCriteria},
        )
      })
    })
  })
})

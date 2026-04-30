import LLMJudge from './LLMJudge'
import {getLLM} from '../../commands/utils/langchain/getLLM'
import ModelFamilyRouter from '../models/ModelFamilyRouter'
import ShuffleMapper from './ShuffleMapper'

jest.mock('../../commands/utils/langchain/getLLM')
jest.mock('../models/ModelFamilyRouter')

describe('LLMJudge', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('evaluate', () => {
    it('should select winner based on judge response with identity shuffle', async () => {
      const candidates = [
        {getOutput: () => ({nodes: [{title: 'Bad'}]}), _nodes: {}},
        {getOutput: () => ({nodes: [{title: 'Good'}]}), _nodes: {}},
      ]

      ModelFamilyRouter.selectJudgeModel.mockReturnValue('Claude')
      getLLM.mockReturnValue({
        llm: {
          invoke: jest.fn().mockResolvedValue({content: '2'}),
        },
      })

      const result = await LLMJudge.evaluate(
        'prompt',
        candidates,
        'OpenAI',
        {},
        {
          shuffleMapperFactory: ShuffleMapper.createIdentityMapping,
        },
      )

      expect(result.winnerIndex).toBe(1)
      expect(result.reason).toBeNull()
    })

    describe('fallback behavior', () => {
      it('should return first candidate when no alternative model available', async () => {
        const candidates = [{getOutput: () => ({nodes: []}), _nodes: {}}]

        ModelFamilyRouter.selectJudgeModel.mockReturnValue(null)

        const result = await LLMJudge.evaluate(
          'prompt',
          candidates,
          'OpenAI',
          {},
          {
            shuffleMapperFactory: ShuffleMapper.createIdentityMapping,
          },
        )

        expect(result.winnerIndex).toBe(0)
        expect(result.reason).toBe('no_alternative_model_available')
      })

      it('should return first candidate on judge response parsing failures', async () => {
        const testCases = [
          {content: 'not a number', reason: 'unparseable_judge_response'},
          {content: '0', reason: 'unparseable_judge_response'},
          {content: '5', reason: 'unparseable_judge_response'},
          {content: '', reason: 'unparseable_judge_response'},
          {content: '  ', reason: 'unparseable_judge_response'},
          {content: 'one', reason: 'unparseable_judge_response'},
        ]

        for (const {content, reason} of testCases) {
          const candidates = [{getOutput: () => ({nodes: []}), _nodes: {}}]

          ModelFamilyRouter.selectJudgeModel.mockReturnValue('Claude')
          getLLM.mockReturnValue({
            llm: {
              invoke: jest.fn().mockResolvedValue({content}),
            },
          })

          const result = await LLMJudge.evaluate(
            'prompt',
            candidates,
            'OpenAI',
            {},
            {
              shuffleMapperFactory: ShuffleMapper.createIdentityMapping,
            },
          )

          expect(result.winnerIndex).toBe(0)
          expect(result.reason).toBe(reason)
        }
      })

      it('should return first candidate on judge invocation exceptions', async () => {
        const candidates = [{getOutput: () => ({nodes: []}), _nodes: {}}]

        ModelFamilyRouter.selectJudgeModel.mockReturnValue('Claude')
        getLLM.mockReturnValue({
          llm: {
            invoke: jest.fn().mockRejectedValue(new Error('API Error')),
          },
        })

        const result = await LLMJudge.evaluate(
          'prompt',
          candidates,
          'OpenAI',
          {},
          {
            shuffleMapperFactory: ShuffleMapper.createIdentityMapping,
          },
        )

        expect(result.winnerIndex).toBe(0)
        expect(result.reason).toBe('judge_invocation_failed')
      })

      it('should preserve fallback to original index 0 regardless of shuffle', async () => {
        const candidates = [
          {getOutput: () => ({nodes: [{title: 'A'}]}), _nodes: {}},
          {getOutput: () => ({nodes: [{title: 'B'}]}), _nodes: {}},
        ]

        ModelFamilyRouter.selectJudgeModel.mockReturnValue('Claude')
        getLLM.mockReturnValue({
          llm: {
            invoke: jest.fn().mockResolvedValue({content: 'garbage'}),
          },
        })

        const result = await LLMJudge.evaluate(
          'prompt',
          candidates,
          'OpenAI',
          {},
          {
            shuffleMapperFactory: () => ShuffleMapper.createExplicitMapping([1, 0]),
          },
        )

        expect(result.winnerIndex).toBe(0)
        expect(result.reason).toBe('unparseable_judge_response')
      })
    })

    describe('shuffle integration', () => {
      it('should remap judge selection to original candidate index', async () => {
        const testCases = [
          {order: [1, 0], judgeSelects: '1', expectsWinner: 1},
          {order: [1, 0], judgeSelects: '2', expectsWinner: 0},
          {order: [2, 0, 1], judgeSelects: '1', expectsWinner: 2},
          {order: [2, 0, 1], judgeSelects: '2', expectsWinner: 0},
          {order: [2, 0, 1], judgeSelects: '3', expectsWinner: 1},
        ]

        for (const {order, judgeSelects, expectsWinner} of testCases) {
          const candidates = Array.from({length: order.length}, (_, i) => ({
            getOutput: () => ({nodes: [{title: `Candidate ${i}`}]}),
            _nodes: {},
          }))

          ModelFamilyRouter.selectJudgeModel.mockReturnValue('Claude')
          getLLM.mockReturnValue({
            llm: {
              invoke: jest.fn().mockResolvedValue({content: judgeSelects}),
            },
          })

          const result = await LLMJudge.evaluate(
            'prompt',
            candidates,
            'OpenAI',
            {},
            {
              shuffleMapperFactory: () => ShuffleMapper.createExplicitMapping(order),
            },
          )

          expect(result.winnerIndex).toBe(expectsWinner)
          expect(result.reason).toBeNull()
        }
      })

      it('should present candidates to judge in shuffled order', async () => {
        const node1 = {id: '1', title: 'First', children: []}
        const node2 = {id: '2', title: 'Second', children: []}
        const node3 = {id: '3', title: 'Third', children: []}

        const candidates = [
          {getOutput: () => ({nodes: [node1]}), _nodes: {1: node1}},
          {getOutput: () => ({nodes: [node2]}), _nodes: {2: node2}},
          {getOutput: () => ({nodes: [node3]}), _nodes: {3: node3}},
        ]

        ModelFamilyRouter.selectJudgeModel.mockReturnValue('Claude')
        const invokeMock = jest.fn().mockResolvedValue({content: '1'})
        getLLM.mockReturnValue({llm: {invoke: invokeMock}})

        await LLMJudge.evaluate(
          'prompt',
          candidates,
          'OpenAI',
          {},
          {
            shuffleMapperFactory: () => ShuffleMapper.createExplicitMapping([2, 0, 1]),
          },
        )

        const judgePrompt = invokeMock.mock.calls[0][0][0].content

        expect(judgePrompt).toContain('Candidate 1:\nThird')
        expect(judgePrompt).toContain('Candidate 2:\nFirst')
        expect(judgePrompt).toContain('Candidate 3:\nSecond')
      })

      it('should maintain valid index bounds after remapping', async () => {
        ;[2, 3, 5].forEach(async count => {
          const candidates = Array.from({length: count}, (_, i) => ({
            getOutput: () => ({nodes: [{title: `C${i}`}]}),
            _nodes: {},
          }))

          ModelFamilyRouter.selectJudgeModel.mockReturnValue('Claude')

          for (let selection = 1; selection <= count; selection++) {
            getLLM.mockReturnValue({
              llm: {
                invoke: jest.fn().mockResolvedValue({content: String(selection)}),
              },
            })

            const result = await LLMJudge.evaluate('prompt', candidates, 'OpenAI', {})

            expect(result.winnerIndex).toBeGreaterThanOrEqual(0)
            expect(result.winnerIndex).toBeLessThan(count)
            expect(result.reason).toBeNull()
          }
        })
      })
    })
  })

  describe('criteria-based evaluation', () => {
    it('should pass criteria to judge prompt when provided', async () => {
      const candidates = [
        {getOutput: () => ({nodes: [{title: 'A'}]}), _nodes: {}},
        {getOutput: () => ({nodes: [{title: 'B'}]}), _nodes: {}},
      ]

      const mockInvoke = jest.fn().mockResolvedValue({content: '1'})

      ModelFamilyRouter.selectJudgeModel.mockReturnValue('Claude')
      getLLM.mockReturnValue({
        llm: {invoke: mockInvoke},
      })

      await LLMJudge.evaluate(
        'prompt',
        candidates,
        'OpenAI',
        {},
        {
          shuffleMapperFactory: ShuffleMapper.createIdentityMapping,
          criteria: 'Check for technical accuracy',
        },
      )

      const invokeCall = mockInvoke.mock.calls[0][0][0]
      expect(invokeCall.content).toContain('Evaluate candidates against these criteria')
      expect(invokeCall.content).toContain('Check for technical accuracy')
    })

    it('should use generic prompt when criteria is empty string', async () => {
      const candidates = [{getOutput: () => ({nodes: [{title: 'A'}]}), _nodes: {}}]

      const mockInvoke = jest.fn().mockResolvedValue({content: '1'})

      ModelFamilyRouter.selectJudgeModel.mockReturnValue('Claude')
      getLLM.mockReturnValue({
        llm: {invoke: mockInvoke},
      })

      await LLMJudge.evaluate(
        'prompt',
        candidates,
        'OpenAI',
        {},
        {
          shuffleMapperFactory: ShuffleMapper.createIdentityMapping,
          criteria: '',
        },
      )

      const invokeCall = mockInvoke.mock.calls[0][0][0]
      expect(invokeCall.content).not.toContain('Evaluate candidates against these criteria')
    })

    it('should use generic prompt when criteria is whitespace only', async () => {
      const candidates = [{getOutput: () => ({nodes: [{title: 'A'}]}), _nodes: {}}]

      const mockInvoke = jest.fn().mockResolvedValue({content: '1'})

      ModelFamilyRouter.selectJudgeModel.mockReturnValue('Claude')
      getLLM.mockReturnValue({
        llm: {invoke: mockInvoke},
      })

      await LLMJudge.evaluate(
        'prompt',
        candidates,
        'OpenAI',
        {},
        {
          shuffleMapperFactory: ShuffleMapper.createIdentityMapping,
          criteria: '   \n  ',
        },
      )

      const invokeCall = mockInvoke.mock.calls[0][0][0]
      expect(invokeCall.content).not.toContain('Evaluate candidates against these criteria')
    })

    it('should use generic prompt when criteria is undefined', async () => {
      const candidates = [{getOutput: () => ({nodes: [{title: 'A'}]}), _nodes: {}}]

      const mockInvoke = jest.fn().mockResolvedValue({content: '1'})

      ModelFamilyRouter.selectJudgeModel.mockReturnValue('Claude')
      getLLM.mockReturnValue({
        llm: {invoke: mockInvoke},
      })

      await LLMJudge.evaluate(
        'prompt',
        candidates,
        'OpenAI',
        {},
        {
          shuffleMapperFactory: ShuffleMapper.createIdentityMapping,
          criteria: undefined,
        },
      )

      const invokeCall = mockInvoke.mock.calls[0][0][0]
      expect(invokeCall.content).not.toContain('Evaluate candidates against these criteria')
    })

    it('should use generic prompt when criteria option is omitted', async () => {
      const candidates = [{getOutput: () => ({nodes: [{title: 'A'}]}), _nodes: {}}]

      const mockInvoke = jest.fn().mockResolvedValue({content: '1'})

      ModelFamilyRouter.selectJudgeModel.mockReturnValue('Claude')
      getLLM.mockReturnValue({
        llm: {invoke: mockInvoke},
      })

      await LLMJudge.evaluate(
        'prompt',
        candidates,
        'OpenAI',
        {},
        {
          shuffleMapperFactory: ShuffleMapper.createIdentityMapping,
        },
      )

      const invokeCall = mockInvoke.mock.calls[0][0][0]
      expect(invokeCall.content).not.toContain('Evaluate candidates against these criteria')
    })

    it('should handle multi-line criteria', async () => {
      const candidates = [{getOutput: () => ({nodes: [{title: 'A'}]}), _nodes: {}}]

      const mockInvoke = jest.fn().mockResolvedValue({content: '1'})

      ModelFamilyRouter.selectJudgeModel.mockReturnValue('Claude')
      getLLM.mockReturnValue({
        llm: {invoke: mockInvoke},
      })

      const multilineCriteria = 'Line 1\nLine 2\nLine 3'

      await LLMJudge.evaluate(
        'prompt',
        candidates,
        'OpenAI',
        {},
        {
          shuffleMapperFactory: ShuffleMapper.createIdentityMapping,
          criteria: multilineCriteria,
        },
      )

      const invokeCall = mockInvoke.mock.calls[0][0][0]
      expect(invokeCall.content).toContain('Line 1')
      expect(invokeCall.content).toContain('Line 2')
      expect(invokeCall.content).toContain('Line 3')
    })
  })

  describe('parseJudgeResponse', () => {
    describe('fast path — bare integer', () => {
      it('should return index for exact bare integer within range', () => {
        expect(LLMJudge.parseJudgeResponse('2', 3)).toEqual({index: 2, reason: null})
      })

      it('should return index for lower bound (1)', () => {
        expect(LLMJudge.parseJudgeResponse('1', 3)).toEqual({index: 1, reason: null})
      })

      it('should return index for upper bound', () => {
        expect(LLMJudge.parseJudgeResponse('3', 3)).toEqual({index: 3, reason: null})
      })

      it('should trim surrounding whitespace before evaluating', () => {
        expect(LLMJudge.parseJudgeResponse('  2  ', 3)).toEqual({index: 2, reason: null})
      })
    })

    describe('extraction path — verbose LLM response', () => {
      it('should extract single in-range integer from verbose response', () => {
        expect(LLMJudge.parseJudgeResponse('Candidate 2 is best', 3)).toEqual({index: 2, reason: null})
      })

      it('should extract from natural language response', () => {
        expect(LLMJudge.parseJudgeResponse("I'd pick number 2", 3)).toEqual({index: 2, reason: null})
      })

      it('should extract when integer appears at end of response', () => {
        expect(LLMJudge.parseJudgeResponse('The answer is 2', 3)).toEqual({index: 2, reason: null})
      })

      it('should ignore out-of-range integers and extract the only in-range one', () => {
        expect(LLMJudge.parseJudgeResponse('Out of 10 options I choose 2', 3)).toEqual({index: 2, reason: null})
      })

      it('should deduplicate repeated in-range integers and resolve unambiguously', () => {
        expect(LLMJudge.parseJudgeResponse('Candidate 2 and again 2', 3)).toEqual({index: 2, reason: null})
      })

      it('should route verbose response through evaluate end-to-end', async () => {
        const candidates = [
          {getOutput: () => ({nodes: [{title: 'A'}]}), _nodes: {}},
          {getOutput: () => ({nodes: [{title: 'B'}]}), _nodes: {}},
        ]
        ModelFamilyRouter.selectJudgeModel.mockReturnValue('Claude')
        getLLM.mockReturnValue({
          llm: {invoke: jest.fn().mockResolvedValue({content: 'Candidate 2 is better'})},
        })

        const result = await LLMJudge.evaluate(
          'prompt',
          candidates,
          'OpenAI',
          {},
          {
            shuffleMapperFactory: ShuffleMapper.createIdentityMapping,
          },
        )

        expect(result.winnerIndex).toBe(1)
        expect(result.reason).toBeNull()
      })
    })

    describe('fallback — unparseable or ambiguous', () => {
      it.each([
        ['empty string', ''],
        ['whitespace only', '   '],
        ['null', null],
        ['undefined', undefined],
      ])('should return unparseable for %s', (_, input) => {
        expect(LLMJudge.parseJudgeResponse(input, 3)).toEqual({index: null, reason: 'unparseable_judge_response'})
      })

      it.each([
        ['zero', '0'],
        ['too high', '5'],
      ])('should return unparseable when out of range — %s', (_, input) => {
        expect(LLMJudge.parseJudgeResponse(input, 3)).toEqual({index: null, reason: 'unparseable_judge_response'})
      })

      it('should return unparseable when no integers found in response', () => {
        expect(LLMJudge.parseJudgeResponse('I refuse to judge', 3)).toEqual({
          index: null,
          reason: 'unparseable_judge_response',
        })
      })

      it('should return unparseable when multiple distinct in-range integers are present', () => {
        expect(LLMJudge.parseJudgeResponse('Between 1 and 2, both are good', 3)).toEqual({
          index: null,
          reason: 'unparseable_judge_response',
        })
      })

      it('should return unparseable when N=1 and response references out-of-range index', () => {
        expect(LLMJudge.parseJudgeResponse('Candidate 2 is best', 1)).toEqual({
          index: null,
          reason: 'unparseable_judge_response',
        })
      })

      it('should accept index 1 when N=1 and response is exact', () => {
        expect(LLMJudge.parseJudgeResponse('1', 1)).toEqual({index: 1, reason: null})
      })
    })
  })
})

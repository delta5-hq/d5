import {ForkJudge} from './ForkJudge'
import Store from '../../commands/utils/Store'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

jest.mock('../../commands/utils/langchain/getLLM', () => ({
  Model: {
    Claude: 'Claude',
    OpenAI: 'OpenAI',
    Deepseek: 'Deepseek',
    Qwen: 'Qwen',
    YandexGPT: 'YandexGPT',
    CustomLLM: 'CustomLLM',
  },
  getIntegrationSettings: jest.fn().mockResolvedValue({openai: {apiKey: 'test'}}),
  determineLLMType: jest.fn().mockReturnValue('OpenAI'),
  getLLM: jest.fn(),
}))

jest.mock('../../commands/utils/NodeTextExtractor', () => ({
  NodeTextExtractor: jest.fn().mockImplementation(() => ({
    extractFullContent: jest.fn().mockResolvedValue('sample content'),
  })),
}))

const {getLLM, getIntegrationSettings} = require('../../commands/utils/langchain/getLLM')
const {NodeTextExtractor} = require('../../commands/utils/NodeTextExtractor')

const buildStore = nodeMap => new Store({userId: 'user1', nodes: nodeMap})

const makeFork = (forkIndex, status = 'ok', extra = {}) => {
  const store = buildStore({
    parent: {id: 'parent', parent: 'root', command: '/chat', children: []},
  })
  return {forkStore: store, forkIndex, status, ...extra}
}

const makeValidate = (id, criterion, n = 1) =>
  buildStore({
    [id]: {id, parent: 'refine', command: `/validate :n=${n} ${criterion}`, children: []},
  }).getNode(id)

const mockLLMRanking = ranking => {
  getLLM.mockReturnValue({
    llm: {
      invoke: jest.fn().mockResolvedValue({content: ranking}),
    },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'test'}})
  NodeTextExtractor.mockImplementation(() => ({
    extractFullContent: jest.fn().mockImplementation(node => {
      return Promise.resolve(`content of ${node?.id || 'unknown'}`)
    }),
  }))
})

describe('ForkJudge.selectWinner', () => {
  describe('no eligible forks', () => {
    it('returns null winner in strict mode when no ok forks', async () => {
      const judge = new ForkJudge('user1', null, buildStore({}))
      const forks = [
        makeFork(0, 'criteria-failed', {failedAt: 'criterion', attempts: 3}),
        makeFork(1, 'runtime-failed', {reason: 'error'}),
      ]
      const result = await judge.selectWinner({forks, validateNodes: [], parentNodeId: 'parent', fallback: false})
      expect(result.winnerForkIndex).toBeNull()
      expect(result.mode).toBe('strict')
      expect(result.selectionLayer).toBe('none')
    })

    it('returns null winner when no forks at all', async () => {
      const judge = new ForkJudge('user1', null, buildStore({}))
      const result = await judge.selectWinner({forks: [], validateNodes: [], parentNodeId: 'parent', fallback: false})
      expect(result.winnerForkIndex).toBeNull()
    })
  })

  describe('single eligible fork — skip judge', () => {
    it('returns the only ok fork as winner without calling LLM', async () => {
      const judge = new ForkJudge('user1', null, buildStore({}))
      const forks = [makeFork(0, 'ok'), makeFork(1, 'runtime-failed', {reason: 'err'})]
      const result = await judge.selectWinner({forks, validateNodes: [], parentNodeId: 'parent', fallback: false})
      expect(result.winnerForkIndex).toBe(0)
      expect(getLLM).not.toHaveBeenCalled()
    })
  })

  describe('fallback mode', () => {
    it('uses criteria-failed forks when no ok forks in fallback mode', async () => {
      mockLLMRanking('1,2,3')
      const judge = new ForkJudge('user1', null, buildStore({}))
      const forks = [
        makeFork(0, 'criteria-failed', {failedAt: 'criterion', attempts: 3}),
        makeFork(1, 'criteria-failed', {failedAt: 'criterion', attempts: 3}),
        makeFork(2, 'runtime-failed', {reason: 'err', forkStore: null}),
      ]
      const result = await judge.selectWinner({forks, validateNodes: [], parentNodeId: 'parent', fallback: true})
      expect(result.winnerForkIndex).not.toBeNull()
      expect(result.selectionLayer).toBe('fallback')
      expect(result.mode).toBe('fallback')
    })

    it('still returns null when no criteria-failed forks in fallback mode', async () => {
      const judge = new ForkJudge('user1', null, buildStore({}))
      const forks = [makeFork(0, 'runtime-failed', {reason: 'err', forkStore: null})]
      const result = await judge.selectWinner({forks, validateNodes: [], parentNodeId: 'parent', fallback: true})
      expect(result.winnerForkIndex).toBeNull()
      expect(result.selectionLayer).toBe('none')
    })
  })

  describe('Borda-count winner selection', () => {
    it('3-fork × 1-criterion: picks fork ranked best by judge', async () => {
      // Judge says fork 2 > fork 0 > fork 1 (1-indexed: "3,1,2")
      mockLLMRanking('3,1,2')
      const judge = new ForkJudge('user1', null, buildStore({}))
      const forks = [makeFork(0), makeFork(1), makeFork(2)]
      const validates = [makeValidate('v1', 'must include numbers')]
      const result = await judge.selectWinner({
        forks,
        validateNodes: validates,
        parentNodeId: 'parent',
        fallback: false,
      })
      // Judge ranking "3,1,2" means: rank-1=candidate3(forkIndex2), rank-2=candidate1(forkIndex0), rank-3=candidate2(forkIndex1)
      expect(result.winnerForkIndex).toBe(2)
      expect(result.selectionLayer).toBe('primary')
    })

    it('3-fork × 2-criteria: picks winner by sum-of-ranks', async () => {
      // Criterion 1: ranks "2,1,3" (candidate2 best, then 1, then 3)
      // Criterion 2: ranks "1,3,2" (candidate1 best, then 3, then 2)
      // Borda scores (lower=better):
      //   fork0 (cand1): crit1 rank=1(score 1), crit2 rank=0(score 0) → total=1
      //   fork1 (cand2): crit1 rank=0(score 0), crit2 rank=2(score 2) → total=2
      //   fork2 (cand3): crit1 rank=2(score 2), crit2 rank=1(score 1) → total=3
      // Wait, need to carefully map 1-indexed ranking to 0-indexed scores
      // "2,1,3": rank1=cand2(idx1), rank2=cand1(idx0), rank3=cand3(idx2)
      //   → criterionScores[0]=1, [1]=0, [2]=2
      // "1,3,2": rank1=cand1(idx0), rank2=cand3(idx2), rank3=cand2(idx1)
      //   → criterionScores[0]=0, [1]=2, [2]=1
      // Total bordaScores: [0]=1+0=1, [1]=0+2=2, [2]=2+1=3
      // Winner = fork0 (lowest score=1)
      let callCount = 0
      getLLM.mockReturnValue({
        llm: {
          invoke: jest.fn().mockImplementation(() => {
            callCount++
            return Promise.resolve({content: callCount === 1 ? '2,1,3' : '1,3,2'})
          }),
        },
      })
      const judge = new ForkJudge('user1', null, buildStore({}))
      const forks = [makeFork(0), makeFork(1), makeFork(2)]
      const validates = [makeValidate('v1', 'criterion A'), makeValidate('v2', 'criterion B')]
      const result = await judge.selectWinner({
        forks,
        validateNodes: validates,
        parentNodeId: 'parent',
        fallback: false,
      })
      expect(result.winnerForkIndex).toBe(0)
      expect(result.perCriterionVerdict).toHaveLength(2)
    })

    it('perCriterionVerdict contains criterion info', async () => {
      mockLLMRanking('1,2')
      const judge = new ForkJudge('user1', null, buildStore({}))
      const forks = [makeFork(0), makeFork(1)]
      const validates = [makeValidate('v1', 'must include numbers')]
      const result = await judge.selectWinner({
        forks,
        validateNodes: validates,
        parentNodeId: 'parent',
        fallback: false,
      })
      expect(result.perCriterionVerdict[0]).toMatchObject({
        criterionId: 'v1',
        criterion: 'must include numbers',
      })
    })
  })

  describe('fallback to generic criterion when no validates', () => {
    it('uses generic quality criterion when validateNodes is empty', async () => {
      mockLLMRanking('1,2')
      const judge = new ForkJudge('user1', null, buildStore({}))
      const forks = [makeFork(0), makeFork(1)]
      const result = await judge.selectWinner({forks, validateNodes: [], parentNodeId: 'parent', fallback: false})
      expect(result.winnerForkIndex).not.toBeNull()
      expect(result.perCriterionVerdict[0].criterionId).toBe('__generic__')
    })
  })
})

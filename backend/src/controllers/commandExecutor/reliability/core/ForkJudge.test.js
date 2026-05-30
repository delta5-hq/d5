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

// ─── Factories ────────────────────────────────────────────────────────────────

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
  getLLM.mockReturnValue({llm: {invoke: jest.fn().mockResolvedValue({content: ranking})}})
}

const mockLLMError = message => {
  getLLM.mockReturnValue({llm: {invoke: jest.fn().mockRejectedValue(new Error(message))}})
}

const makeJudge = () => new ForkJudge('user1', null, buildStore({}))

beforeEach(() => {
  jest.clearAllMocks()
  getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'test'}})
  NodeTextExtractor.mockImplementation(() => ({
    extractFullContent: jest.fn().mockImplementation(node => Promise.resolve(`content of ${node?.id ?? 'unknown'}`)),
  }))
})

// ─── No eligible forks ────────────────────────────────────────────────────────

describe('ForkJudge.selectWinner — no eligible forks', () => {
  it('empty forks array → null winner, selectionLayer none', async () => {
    const result = await makeJudge().selectWinner({
      forks: [],
      validateNodes: [],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.winnerForkIndex).toBeNull()
    expect(result.selectionLayer).toBe('none')
  })

  it('strict mode, no ok forks → null winner, mode strict, selectionLayer none', async () => {
    const forks = [
      makeFork(0, 'criteria-failed', {failedAt: 'criterion', attempts: 3}),
      makeFork(1, 'runtime-failed', {reason: 'error'}),
    ]
    const result = await makeJudge().selectWinner({forks, validateNodes: [], parentNodeId: 'parent', fallback: false})
    expect(result.winnerForkIndex).toBeNull()
    expect(result.mode).toBe('strict')
    expect(result.selectionLayer).toBe('none')
  })

  it('no-eligible-forks path does not set noSignal (signal concept only applies when a winner is selected)', async () => {
    const result = await makeJudge().selectWinner({
      forks: [],
      validateNodes: [],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.noSignal).toBeFalsy()
  })
})

// ─── Single eligible fork — judge skipped ────────────────────────────────────

describe('ForkJudge.selectWinner — single eligible fork', () => {
  it('only ok fork wins without calling LLM', async () => {
    const forks = [makeFork(0, 'ok'), makeFork(1, 'runtime-failed', {reason: 'err'})]
    const result = await makeJudge().selectWinner({forks, validateNodes: [], parentNodeId: 'parent', fallback: false})
    expect(result.winnerForkIndex).toBe(0)
    expect(getLLM).not.toHaveBeenCalled()
  })

  it('single-fork path does not set noSignal (nothing to rank, signal concept does not apply)', async () => {
    const forks = [makeFork(0, 'ok'), makeFork(1, 'runtime-failed', {reason: 'err'})]
    const result = await makeJudge().selectWinner({forks, validateNodes: [], parentNodeId: 'parent', fallback: false})
    expect(result.noSignal).toBeFalsy()
  })
})

// ─── Fallback mode ────────────────────────────────────────────────────────────

describe('ForkJudge.selectWinner — fallback mode', () => {
  it('criteria-failed forks used when no ok forks exist', async () => {
    mockLLMRanking('1,2,3')
    const forks = [
      makeFork(0, 'criteria-failed', {failedAt: 'criterion', attempts: 3}),
      makeFork(1, 'criteria-failed', {failedAt: 'criterion', attempts: 3}),
      makeFork(2, 'runtime-failed', {reason: 'err', forkStore: null}),
    ]
    const result = await makeJudge().selectWinner({forks, validateNodes: [], parentNodeId: 'parent', fallback: true})
    expect(result.winnerForkIndex).not.toBeNull()
    expect(result.selectionLayer).toBe('fallback')
    expect(result.mode).toBe('fallback')
  })

  it('runtime-failed forks excluded from fallback pool even in fallback mode', async () => {
    const forks = [makeFork(0, 'runtime-failed', {reason: 'err', forkStore: null})]
    const result = await makeJudge().selectWinner({forks, validateNodes: [], parentNodeId: 'parent', fallback: true})
    expect(result.winnerForkIndex).toBeNull()
    expect(result.selectionLayer).toBe('none')
  })
})

// ─── Borda-count winner selection ─────────────────────────────────────────────

describe('ForkJudge.selectWinner — Borda-count winner selection', () => {
  it('3-fork × 1-criterion: fork ranked first by judge wins', async () => {
    mockLLMRanking('3,1,2')
    const forks = [makeFork(0), makeFork(1), makeFork(2)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'must include numbers')],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.winnerForkIndex).toBe(2)
    expect(result.selectionLayer).toBe('primary')
  })

  it('3-fork × 2-criteria: sum-of-ranks (Borda-count) determines winner', async () => {
    // Criterion 1 ranking "2,1,3": fork0 rank=1, fork1 rank=0, fork2 rank=2 → Borda [1,0,2]
    // Criterion 2 ranking "1,3,2": fork0 rank=0, fork1 rank=2, fork2 rank=1 → Borda [0,2,1]
    // Total Borda: fork0=1, fork1=2, fork2=3 → fork0 wins (lowest sum)
    let callCount = 0
    getLLM.mockReturnValue({
      llm: {
        invoke: jest.fn().mockImplementation(() => {
          callCount++
          return Promise.resolve({content: callCount === 1 ? '2,1,3' : '1,3,2'})
        }),
      },
    })
    const forks = [makeFork(0), makeFork(1), makeFork(2)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'criterion A'), makeValidate('v2', 'criterion B')],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.winnerForkIndex).toBe(0)
    expect(result.perCriterionVerdict).toHaveLength(2)
  })

  it('Borda tie → fork-0 wins deterministically (initial winnerIdx never overwritten on equal)', async () => {
    // Two jurors give exactly opposite rankings → every fork scores equally
    let callCount = 0
    getLLM.mockReturnValue({
      llm: {
        invoke: jest.fn().mockImplementation(() => {
          callCount++
          return Promise.resolve({content: callCount % 2 === 1 ? '1,2' : '2,1'})
        }),
      },
    })
    const forks = [makeFork(0), makeFork(1)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'criterion', 2)],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.winnerForkIndex).toBe(0)
    expect(result.noSignal).toBeFalsy()
  })

  it('perCriterionVerdict includes criterionId, criterion text, and forkRankings array', async () => {
    mockLLMRanking('1,2')
    const forks = [makeFork(0), makeFork(1)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'must include numbers')],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.perCriterionVerdict[0]).toMatchObject({
      criterionId: 'v1',
      criterion: 'must include numbers',
    })
    expect(Array.isArray(result.perCriterionVerdict[0].forkRankings)).toBe(true)
  })
})

// ─── Generic criterion fallback ───────────────────────────────────────────────

describe('ForkJudge.selectWinner — generic criterion when no validates provided', () => {
  it('uses a single generic quality criterion with id __generic__', async () => {
    mockLLMRanking('1,2')
    const forks = [makeFork(0), makeFork(1)]
    const result = await makeJudge().selectWinner({forks, validateNodes: [], parentNodeId: 'parent', fallback: false})
    expect(result.winnerForkIndex).not.toBeNull()
    expect(result.perCriterionVerdict[0].criterionId).toBe('__generic__')
  })
})

// ─── Juror quorum — exclusion and noSignal ────────────────────────────────────

describe('ForkJudge.selectWinner — juror quorum exclusion and noSignal', () => {
  describe('all jurors excluded → noSignal:true, fork-0 wins deterministically', () => {
    it.each([
      ['unparseable ranking response', () => mockLLMRanking('I cannot determine a ranking.')],
      ['LLM invoke error', () => mockLLMError('network error')],
    ])('%s', async (_, setup) => {
      setup()
      const forks = [makeFork(0), makeFork(1)]
      const result = await makeJudge().selectWinner({
        forks,
        validateNodes: [makeValidate('v1', 'criterion')],
        parentNodeId: 'parent',
        fallback: false,
      })
      expect(result.noSignal).toBe(true)
      expect(result.winnerForkIndex).toBe(0)
    })
  })

  it('all jurors excluded across MULTIPLE criteria → noSignal:true', async () => {
    mockLLMError('timeout')
    const forks = [makeFork(0), makeFork(1)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'criterion A'), makeValidate('v2', 'criterion B')],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.noSignal).toBe(true)
  })

  it('at least one parseable juror → noSignal is absent (falsy)', async () => {
    mockLLMRanking('2,1')
    const forks = [makeFork(0), makeFork(1)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'criterion')],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.noSignal).toBeFalsy()
  })

  it('partial exclusion — excluded juror contributes no Borda score; parseable juror alone determines winner', async () => {
    // 2-juror criterion: juror-1 returns nonsense (excluded), juror-2 ranks "3,1,2" → fork-2 wins
    let callCount = 0
    getLLM.mockReturnValue({
      llm: {
        invoke: jest.fn().mockImplementation(() => {
          callCount++
          return Promise.resolve({content: callCount === 1 ? 'nonsense text' : '3,1,2'})
        }),
      },
    })
    const forks = [makeFork(0), makeFork(1), makeFork(2)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'quality', 2)],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.winnerForkIndex).toBe(2)
    expect(result.noSignal).toBeFalsy()
  })
})

describe('judgeQualityWarnings', () => {
  it('no warnings when multiple families configured including a reasoning-capable one', async () => {
    getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'k'}, claude: {apiKey: 'k'}})
    mockLLMRanking('2,1')
    const forks = [makeFork(0), makeFork(1)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'quality', 1)],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.judgeQualityWarnings).toEqual([])
  })

  it('noReasoningMode warning when only tier-3 families (no Claude or OpenAI) configured', async () => {
    getIntegrationSettings.mockResolvedValue({yandex: {apiKey: 'k'}, custom_llm: {apiRootUrl: 'http://x'}})
    mockLLMRanking('2,1')
    const forks = [makeFork(0), makeFork(1)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'quality', 1)],
      parentNodeId: 'parent',
      fallback: false,
    })
    const conditions = result.judgeQualityWarnings.map(w => w.condition)
    expect(conditions).toContain('noReasoningMode')
    const warn = result.judgeQualityWarnings.find(w => w.condition === 'noReasoningMode')
    expect(warn.severity).toBe('medium')
  })

  it('no noReasoningMode warning when OpenAI is configured', async () => {
    getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'k'}})
    mockLLMRanking('2,1')
    const forks = [makeFork(0), makeFork(1)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'quality', 1)],
      parentNodeId: 'parent',
      fallback: false,
    })
    const conditions = result.judgeQualityWarnings.map(w => w.condition)
    expect(conditions).not.toContain('noReasoningMode')
  })

  it('no noReasoningMode warning when Claude is configured', async () => {
    getIntegrationSettings.mockResolvedValue({claude: {apiKey: 'k'}})
    mockLLMRanking('2,1')
    const forks = [makeFork(0), makeFork(1)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'quality', 1)],
      parentNodeId: 'parent',
      fallback: false,
    })
    const conditions = result.judgeQualityWarnings.map(w => w.condition)
    expect(conditions).not.toContain('noReasoningMode')
  })

  it('singleProvider warning when only one family is configured', async () => {
    getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'k'}})
    mockLLMRanking('2,1')
    const forks = [makeFork(0), makeFork(1)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'quality', 1)],
      parentNodeId: 'parent',
      fallback: false,
    })
    const conditions = result.judgeQualityWarnings.map(w => w.condition)
    expect(conditions).toContain('singleProvider')
    const warn = result.judgeQualityWarnings.find(w => w.condition === 'singleProvider')
    expect(warn.severity).toBe('high')
  })

  it('lowestTierOnly warning when only tier-3 families configured (also triggers noReasoningMode)', async () => {
    getIntegrationSettings.mockResolvedValue({yandex: {apiKey: 'k'}, custom_llm: {apiRootUrl: 'http://x'}})
    mockLLMRanking('2,1')
    const forks = [makeFork(0), makeFork(1)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'quality', 1)],
      parentNodeId: 'parent',
      fallback: false,
    })
    const conditions = result.judgeQualityWarnings.map(w => w.condition)
    expect(conditions).toContain('lowestTierOnly')
    expect(conditions).toContain('noReasoningMode')
    const warn = result.judgeQualityWarnings.find(w => w.condition === 'lowestTierOnly')
    expect(warn.severity).toBe('medium')
  })

  it('juryDuplicates warning when jury size exceeds distinct configured families', async () => {
    // Only 1 family → juror pool of 2 forces a duplicate
    getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'k'}})
    mockLLMRanking('2,1')
    const forks = [makeFork(0), makeFork(1)]
    const result = await makeJudge().selectWinner({
      forks,
      // jurorCount=2, but only 1 family → duplicate
      validateNodes: [makeValidate('v1', 'quality', 2)],
      parentNodeId: 'parent',
      fallback: false,
    })
    const conditions = result.judgeQualityWarnings.map(w => w.condition)
    expect(conditions).toContain('juryDuplicates')
    const warn = result.judgeQualityWarnings.find(w => w.condition === 'juryDuplicates')
    expect(warn.severity).toBe('low')
  })

  it('fallbackWithWeakJudge warning when fallback mode and single provider', async () => {
    getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'k'}})
    mockLLMRanking('2,1')
    const primaryForks = []
    const fallbackForks = [makeFork(0, 'criteria-failed'), makeFork(1, 'criteria-failed')]
    const result = await makeJudge().selectWinner({
      forks: [...primaryForks, ...fallbackForks],
      validateNodes: [makeValidate('v1', 'quality', 1)],
      parentNodeId: 'parent',
      fallback: true,
    })
    const conditions = result.judgeQualityWarnings.map(w => w.condition)
    expect(conditions).toContain('fallbackWithWeakJudge')
    const warn = result.judgeQualityWarnings.find(w => w.condition === 'fallbackWithWeakJudge')
    expect(warn.severity).toBe('high')
  })

  it('early return (no candidates) yields empty judgeQualityWarnings', async () => {
    const result = await makeJudge().selectWinner({
      forks: [makeFork(0, 'runtime-failed')],
      validateNodes: [],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.judgeQualityWarnings).toEqual([])
  })

  it('early return (single candidate) yields empty judgeQualityWarnings', async () => {
    const result = await makeJudge().selectWinner({
      forks: [makeFork(0)],
      validateNodes: [],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.judgeQualityWarnings).toEqual([])
  })

  it('degradedInput warning when configured families produce a per-fork budget below threshold', async () => {
    // YandexGPT has the smallest context window (~8k tokens). With 50 forks the per-fork
    // budget falls below DEGRADED_INPUT_THRESHOLD_CHARS.
    getIntegrationSettings.mockResolvedValue({yandex: {apiKey: 'k'}})
    mockLLMRanking('2,1')
    const forks = Array.from({length: 50}, (_, i) => makeFork(i))
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'quality', 1)],
      parentNodeId: 'parent',
      fallback: false,
    })
    const conditions = result.judgeQualityWarnings.map(w => w.condition)
    expect(conditions).toContain('degradedInput')
    const warn = result.judgeQualityWarnings.find(w => w.condition === 'degradedInput')
    expect(warn.severity).toBe('high')
  })

  it('no degradedInput warning for large-context family with few forks', async () => {
    getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'k'}})
    mockLLMRanking('2,1')
    const forks = [makeFork(0), makeFork(1)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'quality', 1)],
      parentNodeId: 'parent',
      fallback: false,
    })
    const conditions = result.judgeQualityWarnings.map(w => w.condition)
    expect(conditions).not.toContain('degradedInput')
  })
})

// ─── Tiebreak detection ───────────────────────────────────────────────────────

describe('ForkJudge.selectWinner — tiebreakUsed', () => {
  it('tiebreakUsed:false when 2-fork jury produces a clear unambiguous winner', async () => {
    // ranking '1,2': fork-0 scores 0, fork-1 scores 1 → fork-0 wins uniquely
    mockLLMRanking('1,2')
    const forks = [makeFork(0), makeFork(1)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'criterion')],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.tiebreakUsed).toBe(false)
  })

  it('tiebreakUsed:false when 3-fork jury produces a clear unambiguous winner', async () => {
    // ranking '1,2,3': fork-0=0, fork-1=1, fork-2=2 → fork-0 wins uniquely
    mockLLMRanking('1,2,3')
    const forks = [makeFork(0), makeFork(1), makeFork(2)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'criterion')],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.tiebreakUsed).toBe(false)
    expect(result.winnerForkIndex).toBe(0)
  })

  it('tiebreakUsed:true when all jurors are excluded (noSignal — all Borda scores zero)', async () => {
    mockLLMError('timeout')
    const forks = [makeFork(0), makeFork(1)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'criterion')],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.noSignal).toBe(true)
    expect(result.tiebreakUsed).toBe(true)
  })

  it('tiebreakUsed:true when two forks share the winning Borda score', async () => {
    // juror 1: '1,2' → fork-0=0, fork-1=1
    // juror 2: '2,1' → fork-0=1, fork-1=0
    // totals: fork-0=1, fork-1=1 — complete tie; fork-0 wins by position
    getLLM
      .mockReturnValueOnce({llm: {invoke: jest.fn().mockResolvedValue({content: '1,2'})}})
      .mockReturnValueOnce({llm: {invoke: jest.fn().mockResolvedValue({content: '2,1'})}})
    getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'k'}, claude: {apiKey: 'c'}})
    const forks = [makeFork(0), makeFork(1)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'criterion', 2)],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.tiebreakUsed).toBe(true)
    expect(result.winnerForkIndex).toBe(0)
  })

  it('tiebreakUsed:true for 3-fork partial tie where winner ties with one fork but not the third', async () => {
    // juror 1: '1,2,3' → fork-0=0, fork-1=1, fork-2=2
    // juror 2: '2,1,3' → fork-0=1, fork-1=0, fork-2=2
    // totals: fork-0=1, fork-1=1, fork-2=4 — fork-0 and fork-1 tie at 1; fork-0 wins by position
    getLLM
      .mockReturnValueOnce({llm: {invoke: jest.fn().mockResolvedValue({content: '1,2,3'})}})
      .mockReturnValueOnce({llm: {invoke: jest.fn().mockResolvedValue({content: '2,1,3'})}})
    getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'k'}, claude: {apiKey: 'c'}})
    const forks = [makeFork(0), makeFork(1), makeFork(2)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'criterion', 2)],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.tiebreakUsed).toBe(true)
    expect(result.winnerForkIndex).toBe(0)
  })

  it('single-candidate early return has no tiebreakUsed field', async () => {
    const result = await makeJudge().selectWinner({
      forks: [makeFork(0)],
      validateNodes: [],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.tiebreakUsed).toBeUndefined()
  })

  it('no-candidates early return has no tiebreakUsed field', async () => {
    const result = await makeJudge().selectWinner({
      forks: [makeFork(0, 'runtime-failed', {reason: 'err', forkStore: null})],
      validateNodes: [],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.tiebreakUsed).toBeUndefined()
  })
})

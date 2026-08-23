import {ForkJudge} from './ForkJudge'
import Store from '../../commands/utils/Store'
import {FAILURE_CAUSE, REMEDIATION_HINT, JUDGE_WARNING_CONDITION} from './failureSemantics'

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
    extractFullContent: jest.fn().mockResolvedValue('sample output that is substantive and passes the structural gate'),
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
    [id]: {
      id,
      parent: 'elect',
      command: `/validate :n=${n} ${criterion}`,
      children: [],
    },
  }).getNode(id)

const mockLLMRanking = ranking => {
  getLLM.mockReturnValue({
    llm: {invoke: jest.fn().mockResolvedValue({content: ranking})},
  })
}

const mockLLMRankingWithChunkSize = (ranking, chunkSize) => {
  const invoke = jest.fn().mockResolvedValue({content: ranking})
  getLLM.mockReturnValue({llm: {invoke}, chunkSize})
  return invoke
}

const mockLLMError = message => {
  getLLM.mockReturnValue({
    llm: {invoke: jest.fn().mockRejectedValue(new Error(message))},
  })
}

const mockLLMResolutionError = message => {
  getLLM.mockImplementation(() => {
    throw new Error(message)
  })
}

const makeJudge = () => new ForkJudge('user1', null, buildStore({}))

const warningConditions = result => result.judgeQualityWarnings.map(w => w.condition)

beforeEach(() => {
  jest.clearAllMocks()
  getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'test'}})
  NodeTextExtractor.mockImplementation(() => ({
    extractFullContent: jest
      .fn()
      .mockImplementation(node => Promise.resolve(`output from node ${node?.id ?? 'unknown'}`)),
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
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [],
      parentNodeId: 'parent',
      fallback: false,
    })
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

  it('no-eligible-forks path sets allGateFiltered: false', async () => {
    const result = await makeJudge().selectWinner({
      forks: [],
      validateNodes: [],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.allGateFiltered).toBe(false)
  })

  it.each([
    ['empty fork set', [], FAILURE_CAUSE.NO_ELIGIBLE_FORKS, REMEDIATION_HINT.NONE],
    [
      'all runtime-failed',
      [makeFork(0, 'runtime-failed', {reason: 'auth', forkStore: null})],
      FAILURE_CAUSE.RUNTIME_FAILED,
      REMEDIATION_HINT.CHECK_PROVIDER,
    ],
    [
      'all criteria-failed strict',
      [makeFork(0, 'criteria-failed', {failedAt: 'criterion', attempts: 3})],
      FAILURE_CAUSE.CRITERIA_FAILED,
      REMEDIATION_HINT.ADJUST_CRITERIA,
    ],
    [
      'mixed ineligible fork states',
      [
        makeFork(0, 'criteria-failed', {failedAt: 'criterion', attempts: 3}),
        makeFork(1, 'runtime-failed', {reason: 'auth', forkStore: null}),
      ],
      FAILURE_CAUSE.NO_ELIGIBLE_FORKS,
      REMEDIATION_HINT.NONE,
    ],
  ])('%s failure semantics are preserved', async (_, forks, failureCause, remediationHint) => {
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result).toEqual(expect.objectContaining({failureCause, remediationHint}))
  })
})

// ─── Single eligible fork — judge skipped ────────────────────────────────────

describe('ForkJudge.selectWinner — single eligible fork', () => {
  it('only ok fork wins without calling LLM', async () => {
    const forks = [makeFork(0, 'ok'), makeFork(1, 'runtime-failed', {reason: 'err'})]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.winnerForkIndex).toBe(0)
    expect(getLLM).not.toHaveBeenCalled()
  })

  it('single-fork path does not set noSignal (nothing to rank, signal concept does not apply)', async () => {
    const forks = [makeFork(0, 'ok'), makeFork(1, 'runtime-failed', {reason: 'err'})]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.noSignal).toBeFalsy()
  })

  it('single-fork path sets allGateFiltered: false', async () => {
    const forks = [makeFork(0, 'ok'), makeFork(1, 'runtime-failed', {reason: 'err'})]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.allGateFiltered).toBe(false)
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
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [],
      parentNodeId: 'parent',
      fallback: true,
    })
    expect(result.winnerForkIndex).not.toBeNull()
    expect(result.selectionLayer).toBe('fallback')
    expect(result.mode).toBe('fallback')
  })

  it('runtime-failed forks excluded from fallback pool even in fallback mode', async () => {
    const forks = [makeFork(0, 'runtime-failed', {reason: 'err', forkStore: null})]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [],
      parentNodeId: 'parent',
      fallback: true,
    })
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
          return Promise.resolve({
            content: callCount === 1 ? '2,1,3' : '1,3,2',
          })
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
          return Promise.resolve({
            content: callCount % 2 === 1 ? '1,2' : '2,1',
          })
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
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.winnerForkIndex).not.toBeNull()
    expect(result.perCriterionVerdict[0].criterionId).toBe('__generic__')
  })
})

// ─── Juror quorum — exclusion and noSignal ────────────────────────────────────

describe('ForkJudge.selectWinner — juror quorum exclusion and noSignal', () => {
  describe('all jurors excluded, strict mode → noSignal:true, null winner, no tiebreak', () => {
    it.each([
      ['unparseable ranking response', () => mockLLMRanking('I cannot determine a ranking.')],
      ['model resolution error', () => mockLLMResolutionError('model unavailable')],
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
      expect(result.winnerForkIndex).toBeNull()
      expect(result.tiebreakUsed).toBe(false)
      expect(result.mode).toBe('strict')
      expect(result.selectionLayer).toBe('none')
      expect(Array.isArray(result.judgeQualityWarnings)).toBe(true)
    })
  })

  describe('all jurors excluded, fallback mode → noSignal:true, fork-0 wins, tiebreak fires', () => {
    it.each([
      ['unparseable ranking response', () => mockLLMRanking('I cannot determine a ranking.')],
      ['model resolution error', () => mockLLMResolutionError('model unavailable')],
      ['LLM invoke error', () => mockLLMError('network error')],
    ])('%s', async (_, setup) => {
      setup()
      const forks = [makeFork(0), makeFork(1)]
      const result = await makeJudge().selectWinner({
        forks,
        validateNodes: [makeValidate('v1', 'criterion')],
        parentNodeId: 'parent',
        fallback: true,
      })
      expect(result.noSignal).toBe(true)
      expect(result.winnerForkIndex).toBe(0)
      expect(result.tiebreakUsed).toBe(true)
      expect(result.mode).toBe('fallback')
    })
  })

  it('all jurors excluded across multiple criteria, strict mode → noSignal:true, winnerForkIndex:null', async () => {
    mockLLMError('timeout')
    const forks = [makeFork(0), makeFork(1)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'criterion A'), makeValidate('v2', 'criterion B')],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.noSignal).toBe(true)
    expect(result.winnerForkIndex).toBeNull()
  })

  it('all jurors excluded, strict mode, no validate nodes (generic criterion) → noSignal:true, winnerForkIndex:null', async () => {
    mockLLMError('network error')
    const forks = [makeFork(0), makeFork(1)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.noSignal).toBe(true)
    expect(result.winnerForkIndex).toBeNull()
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
    let callCount = 0
    getLLM.mockReturnValue({
      llm: {
        invoke: jest.fn().mockImplementation(() => {
          callCount++
          return Promise.resolve({
            content: callCount === 1 ? 'nonsense text' : '3,1,2',
          })
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

  it('model resolution failure excludes only that juror when another juror produces a ranking', async () => {
    getIntegrationSettings.mockResolvedValue({
      openai: {apiKey: 'k'},
      claude: {apiKey: 'k'},
    })
    getLLM
      .mockImplementationOnce(() => {
        throw new Error('model unavailable')
      })
      .mockReturnValueOnce({
        llm: {invoke: jest.fn().mockResolvedValue({content: '2,1'})},
        chunkSize: 200_000,
      })

    const forks = [makeFork(0), makeFork(1)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'quality', 2)],
      parentNodeId: 'parent',
      fallback: false,
    })

    expect(result.winnerForkIndex).toBe(1)
    expect(result.noSignal).toBeFalsy()
  })
})

describe('judgeQualityWarnings', () => {
  it('no warnings when multiple families configured including a reasoning-capable one', async () => {
    getIntegrationSettings.mockResolvedValue({
      openai: {apiKey: 'k'},
      claude: {apiKey: 'k'},
    })
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
    getIntegrationSettings.mockResolvedValue({
      yandex: {apiKey: 'k'},
      custom_llm: {apiRootUrl: 'http://x'},
    })
    mockLLMRanking('2,1')
    const forks = [makeFork(0), makeFork(1)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'quality', 1)],
      parentNodeId: 'parent',
      fallback: false,
    })
    const conditions = warningConditions(result)
    expect(conditions).toContain(JUDGE_WARNING_CONDITION.NO_REASONING_MODE)
    const warn = result.judgeQualityWarnings.find(w => w.condition === JUDGE_WARNING_CONDITION.NO_REASONING_MODE)
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
    const conditions = warningConditions(result)
    expect(conditions).not.toContain(JUDGE_WARNING_CONDITION.NO_REASONING_MODE)
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
    const conditions = warningConditions(result)
    expect(conditions).not.toContain(JUDGE_WARNING_CONDITION.NO_REASONING_MODE)
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
    const conditions = warningConditions(result)
    expect(conditions).toContain(JUDGE_WARNING_CONDITION.SINGLE_PROVIDER)
    const warn = result.judgeQualityWarnings.find(w => w.condition === JUDGE_WARNING_CONDITION.SINGLE_PROVIDER)
    expect(warn.severity).toBe('high')
  })

  it('lowestTierOnly warning when only tier-3 families configured (also triggers noReasoningMode)', async () => {
    getIntegrationSettings.mockResolvedValue({
      yandex: {apiKey: 'k'},
      custom_llm: {apiRootUrl: 'http://x'},
    })
    mockLLMRanking('2,1')
    const forks = [makeFork(0), makeFork(1)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'quality', 1)],
      parentNodeId: 'parent',
      fallback: false,
    })
    const conditions = warningConditions(result)
    expect(conditions).toContain(JUDGE_WARNING_CONDITION.LOWEST_TIER_ONLY)
    expect(conditions).toContain(JUDGE_WARNING_CONDITION.NO_REASONING_MODE)
    const warn = result.judgeQualityWarnings.find(w => w.condition === JUDGE_WARNING_CONDITION.LOWEST_TIER_ONLY)
    expect(warn.severity).toBe('medium')
  })

  it('juryDuplicates warning when jury size exceeds distinct configured families', async () => {
    getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'k'}})
    mockLLMRanking('2,1')
    const forks = [makeFork(0), makeFork(1)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'quality', 2)],
      parentNodeId: 'parent',
      fallback: false,
    })
    const conditions = warningConditions(result)
    expect(conditions).toContain(JUDGE_WARNING_CONDITION.JURY_DUPLICATES)
    const warn = result.judgeQualityWarnings.find(w => w.condition === JUDGE_WARNING_CONDITION.JURY_DUPLICATES)
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
    const conditions = warningConditions(result)
    expect(conditions).toContain(JUDGE_WARNING_CONDITION.FALLBACK_WITH_WEAK_JUDGE)
    const warn = result.judgeQualityWarnings.find(w => w.condition === JUDGE_WARNING_CONDITION.FALLBACK_WITH_WEAK_JUDGE)
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
    getIntegrationSettings.mockResolvedValue({yandex: {apiKey: 'k'}})
    mockLLMRanking('2,1')
    const forks = Array.from({length: 50}, (_, i) => makeFork(i))
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'quality', 1)],
      parentNodeId: 'parent',
      fallback: false,
    })
    const conditions = warningConditions(result)
    expect(conditions).toContain(JUDGE_WARNING_CONDITION.DEGRADED_INPUT)
    const warn = result.judgeQualityWarnings.find(w => w.condition === JUDGE_WARNING_CONDITION.DEGRADED_INPUT)
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
    const conditions = warningConditions(result)
    expect(conditions).not.toContain(JUDGE_WARNING_CONDITION.DEGRADED_INPUT)
  })

  it('degradedInput uses the resolved judge model chunkSize, not the provider family default', async () => {
    getIntegrationSettings.mockResolvedValue({
      openai: {apiKey: 'k', model: 'small-context-test-model'},
    })
    mockLLMRankingWithChunkSize('2,1', 1_000)
    const forks = [makeFork(0), makeFork(1)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [],
      parentNodeId: 'parent',
      fallback: false,
    })

    const conditions = warningConditions(result)
    expect(conditions).toContain(JUDGE_WARNING_CONDITION.DEGRADED_INPUT)
  })

  it('judge prompt slices candidate content by resolved model chunkSize', async () => {
    getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'k'}})
    NodeTextExtractor.mockImplementation(() => ({
      extractFullContent: jest.fn().mockResolvedValue('x'.repeat(10_000)),
    }))
    const invoke = mockLLMRankingWithChunkSize('1,2', 1_000)
    const forks = [makeFork(0), makeFork(1)]

    await makeJudge().selectWinner({
      forks,
      validateNodes: [],
      parentNodeId: 'parent',
      fallback: false,
    })

    const humanMessage = invoke.mock.calls[0][0][1]
    expect(humanMessage.content).not.toContain('x'.repeat(3_000))
  })

  it('returns judge input diagnostics for metadata and verdict drawer auditability', async () => {
    getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'k'}})
    mockLLMRankingWithChunkSize('1,2', 1_000)
    const forks = [makeFork(0), makeFork(1)]

    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [],
      parentNodeId: 'parent',
      fallback: false,
    })

    expect(result.judgeInput).toEqual({
      candidateCount: 2,
      perForkBudgetChars: 1000,
      degradedInput: true,
      resolvedJudgeFamilies: ['OpenAI'],
    })
  })

  it.each([
    {
      name: 'primary eligible candidates',
      forks: [makeFork(0), makeFork(1), makeFork(2)],
      fallback: false,
      expectedLayer: 'primary',
      ranking: '1,2,3',
    },
    {
      name: 'fallback candidates after criteria failure',
      forks: [makeFork(0, 'criteria-failed'), makeFork(1, 'criteria-failed'), makeFork(2, 'runtime-failed')],
      fallback: true,
      expectedLayer: 'fallback',
      ranking: '1,2',
    },
  ])('judge input diagnostics describe the actual $name pool', async ({forks, fallback, expectedLayer, ranking}) => {
    getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'k'}})
    mockLLMRankingWithChunkSize(ranking, 4_000)

    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [],
      parentNodeId: 'parent',
      fallback,
    })

    expect(result.selectionLayer).toBe(expectedLayer)
    expect(result.judgeInput).toMatchObject({
      candidateCount: expectedLayer === 'primary' ? 3 : 2,
      degradedInput: false,
      resolvedJudgeFamilies: ['OpenAI'],
    })
    expect(result.judgeInput.perForkBudgetChars).toBeGreaterThan(0)
  })

  it('deduplicates resolved judge families in judge input diagnostics when a jury reuses one family', async () => {
    getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'k'}})
    mockLLMRankingWithChunkSize('1,2', 8_000)

    const result = await makeJudge().selectWinner({
      forks: [makeFork(0), makeFork(1)],
      validateNodes: [makeValidate('v1', 'quality', 3)],
      parentNodeId: 'parent',
      fallback: false,
    })

    expect(result.judgeInput.resolvedJudgeFamilies).toEqual(['OpenAI'])
    expect(warningConditions(result)).toContain(JUDGE_WARNING_CONDITION.JURY_DUPLICATES)
  })

  it('omits judge input diagnostics when no judge was needed', async () => {
    const noCandidateResult = await makeJudge().selectWinner({
      forks: [makeFork(0, 'runtime-failed')],
      validateNodes: [],
      parentNodeId: 'parent',
      fallback: false,
    })
    const singleCandidateResult = await makeJudge().selectWinner({
      forks: [makeFork(0)],
      validateNodes: [],
      parentNodeId: 'parent',
      fallback: false,
    })

    expect(noCandidateResult.judgeInput).toBeUndefined()
    expect(singleCandidateResult.judgeInput).toBeUndefined()
  })

  it('judge prompt uses the smallest resolved chunkSize across the active jury', async () => {
    getIntegrationSettings.mockResolvedValue({
      openai: {apiKey: 'k'},
      claude: {apiKey: 'k'},
    })
    NodeTextExtractor.mockImplementation(() => ({
      extractFullContent: jest.fn().mockResolvedValue('x'.repeat(10_000)),
    }))
    const largeContextInvoke = jest.fn().mockResolvedValue({content: '1,2'})
    const smallContextInvoke = jest.fn().mockResolvedValue({content: '2,1'})
    getLLM
      .mockReturnValueOnce({
        llm: {invoke: largeContextInvoke},
        chunkSize: 200_000,
      })
      .mockReturnValueOnce({
        llm: {invoke: smallContextInvoke},
        chunkSize: 1_000,
      })
    const forks = [makeFork(0), makeFork(1)]

    await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'quality', 2)],
      parentNodeId: 'parent',
      fallback: false,
    })

    const firstHumanMessage = largeContextInvoke.mock.calls[0][0][1]
    const secondHumanMessage = smallContextInvoke.mock.calls[0][0][1]
    expect(firstHumanMessage.content).not.toContain('x'.repeat(3_000))
    expect(secondHumanMessage.content).not.toContain('x'.repeat(3_000))
  })
})

// ─── Tiebreak detection ───────────────────────────────────────────────────────

describe('ForkJudge.selectWinner — tiebreakUsed', () => {
  it('tiebreakUsed:false when 2-fork jury produces a clear unambiguous winner', async () => {
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

  it('tiebreakUsed:true when all jurors are excluded in fallback mode (all Borda scores zero)', async () => {
    mockLLMError('timeout')
    const forks = [makeFork(0), makeFork(1)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'criterion')],
      parentNodeId: 'parent',
      fallback: true,
    })
    expect(result.noSignal).toBe(true)
    expect(result.tiebreakUsed).toBe(true)
  })

  it('tiebreakUsed:true for 3-fork fallback with no usable juror rankings (all Borda scores zero)', async () => {
    mockLLMError('timeout')
    const forks = [makeFork(0), makeFork(1), makeFork(2)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [makeValidate('v1', 'criterion')],
      parentNodeId: 'parent',
      fallback: true,
    })
    expect(result.noSignal).toBe(true)
    expect(result.tiebreakUsed).toBe(true)
    expect(result.winnerForkIndex).toBe(0)
  })

  it('tiebreakUsed:true when two forks share the winning Borda score', async () => {
    // juror 1: '1,2' → fork-0=0, fork-1=1
    // juror 2: '2,1' → fork-0=1, fork-1=0
    // totals: fork-0=1, fork-1=1 — complete tie; fork-0 wins by position
    getLLM
      .mockReturnValueOnce({
        llm: {invoke: jest.fn().mockResolvedValue({content: '1,2'})},
      })
      .mockReturnValueOnce({
        llm: {invoke: jest.fn().mockResolvedValue({content: '2,1'})},
      })
    getIntegrationSettings.mockResolvedValue({
      openai: {apiKey: 'k'},
      claude: {apiKey: 'c'},
    })
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
      .mockReturnValueOnce({
        llm: {invoke: jest.fn().mockResolvedValue({content: '1,2,3'})},
      })
      .mockReturnValueOnce({
        llm: {invoke: jest.fn().mockResolvedValue({content: '2,1,3'})},
      })
    getIntegrationSettings.mockResolvedValue({
      openai: {apiKey: 'k'},
      claude: {apiKey: 'c'},
    })
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

  it('single eligible fork passes gate → tiebreakUsed:false (nothing to rank)', async () => {
    const result = await makeJudge().selectWinner({
      forks: [makeFork(0)],
      validateNodes: [],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.tiebreakUsed).toBe(false)
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

describe('ForkJudge.selectWinner — structural gate on candidate content', () => {
  const SUBSTANTIVE_A = 'substantive output from fork A that passes the structural gate check'
  const SUBSTANTIVE_B = 'substantive output from fork B that passes the structural gate check'

  const GATE_REJECTION_INPUTS = [
    ['empty string', ''],
    ['whitespace-only string', '   '],
    ['refusal pattern', "I'm sorry, I cannot help with that."],
    ['truncated output below MIN_SUBSTANTIVE_CHARS', 'Too short.'],
  ]

  const mockContentSequence = (...contentItems) => {
    let callCount = 0
    NodeTextExtractor.mockImplementation(() => {
      const content = contentItems[callCount++] ?? SUBSTANTIVE_A
      return {extractFullContent: jest.fn().mockResolvedValue(content)}
    })
  }

  describe('single gate-survivor: sole-survivor wins without judge invocation', () => {
    it.each(GATE_REJECTION_INPUTS)(
      'fork-0 with %s is eliminated; fork-1 wins as sole survivor',
      async (_, rejectedContent) => {
        mockContentSequence(rejectedContent, SUBSTANTIVE_A)
        const result = await makeJudge().selectWinner({
          forks: [makeFork(0), makeFork(1)],
          validateNodes: [],
          parentNodeId: 'parent',
          fallback: false,
        })
        expect(result.winnerForkIndex).toBe(1)
        expect(result.selectionLayer).toBe('primary')
        expect(result.noSignal).toBe(false)
        expect(result.tiebreakUsed).toBe(false)
        expect(getLLM).not.toHaveBeenCalled()
      },
    )

    it('execution-error prompt nodes are rejected before judge even when their text is substantive', async () => {
      mockContentSequence(SUBSTANTIVE_A, SUBSTANTIVE_B)
      const result = await makeJudge().selectWinner({
        forks: [
          makeFork(0, 'ok', {
            leafOutputs: [
              {
                nodeId: 'err',
                content: SUBSTANTIVE_A,
                executionStatus: 'error',
              },
            ],
          }),
          makeFork(1),
        ],
        validateNodes: [],
        parentNodeId: 'parent',
        fallback: false,
      })

      expect(result.winnerForkIndex).toBe(1)
      expect(getLLM).not.toHaveBeenCalled()
      expect(result.allGateFiltered).toBe(false)
    })

    it.each([
      ['no executionStatus field', {}],
      ['executionStatus success', {executionStatus: 'success'}],
    ])('%s does NOT trigger structural gate rejection — only executionStatus=error does', async (_, extra) => {
      // The structural gate only rejects on executionStatus==='error'.
      // Forks without that status pass the gate and proceed to the LLM judge.
      NodeTextExtractor.mockImplementation(() => ({extractFullContent: jest.fn().mockResolvedValue(SUBSTANTIVE_A)}))
      const fork0 = makeFork(0, 'ok', {leafOutputs: [{nodeId: 'n0', content: SUBSTANTIVE_A, ...extra}]})
      await makeJudge().selectWinner({
        forks: [fork0, makeFork(1)],
        validateNodes: [],
        parentNodeId: 'parent',
        fallback: false,
      })
      expect(fork0.reason).toBeUndefined()
    })

    it('non-deterministic gate rejection (empty content, no failure signal) does not set fork.reason — reason is exclusive to machine-readable signals', async () => {
      mockContentSequence('', SUBSTANTIVE_A)
      const rejectedFork = makeFork(0)
      await makeJudge().selectWinner({
        forks: [rejectedFork, makeFork(1)],
        validateNodes: [],
        parentNodeId: 'parent',
        fallback: false,
      })
      expect(rejectedFork.reason).toBeUndefined()
    })

    it('sole survivor when multiple earlier forks are gate-rejected', async () => {
      mockContentSequence('', 'Too short.', SUBSTANTIVE_A)
      const result = await makeJudge().selectWinner({
        forks: [makeFork(0), makeFork(1), makeFork(2)],
        validateNodes: [],
        parentNodeId: 'parent',
        fallback: false,
      })
      expect(result.winnerForkIndex).toBe(2)
      expect(getLLM).not.toHaveBeenCalled()
    })

    it('original forkIndex is preserved for the sole survivor regardless of its position in fork array', async () => {
      mockContentSequence(SUBSTANTIVE_A, '', '')
      const result = await makeJudge().selectWinner({
        forks: [makeFork(7), makeFork(8), makeFork(9)],
        validateNodes: [],
        parentNodeId: 'parent',
        fallback: false,
      })
      expect(result.winnerForkIndex).toBe(7)
      expect(getLLM).not.toHaveBeenCalled()
    })
  })

  describe('sole pool candidate: gate applied unconditionally even when pool size is 1', () => {
    it('substantive content — sole ok fork passes gate, wins without judge, allGateFiltered:false', async () => {
      const result = await makeJudge().selectWinner({
        forks: [makeFork(0), makeFork(1, 'runtime-failed', {reason: 'err', forkStore: null})],
        validateNodes: [],
        parentNodeId: 'parent',
        fallback: false,
      })
      expect(result.winnerForkIndex).toBe(0)
      expect(result.allGateFiltered).toBe(false)
      expect(getLLM).not.toHaveBeenCalled()
    })

    it.each(GATE_REJECTION_INPUTS)(
      'strict mode — sole ok fork with %s is gate-rejected → null winner, allGateFiltered:true',
      async (_, rejectedContent) => {
        mockContentSequence(rejectedContent)
        const result = await makeJudge().selectWinner({
          forks: [makeFork(0), makeFork(1, 'runtime-failed', {reason: 'err', forkStore: null})],
          validateNodes: [],
          parentNodeId: 'parent',
          fallback: false,
        })
        expect(result.winnerForkIndex).toBeNull()
        expect(result.allGateFiltered).toBe(true)
        expect(result.selectionLayer).toBe('none')
        expect(getLLM).not.toHaveBeenCalled()
      },
    )

    it.each(GATE_REJECTION_INPUTS)(
      'fallback mode — sole criteria-failed fork with %s is gate-rejected → null winner, allGateFiltered:true',
      async (_, rejectedContent) => {
        mockContentSequence(rejectedContent)
        const result = await makeJudge().selectWinner({
          forks: [makeFork(0, 'criteria-failed'), makeFork(1, 'runtime-failed', {reason: 'err', forkStore: null})],
          validateNodes: [],
          parentNodeId: 'parent',
          fallback: true,
        })
        expect(result.winnerForkIndex).toBeNull()
        expect(result.allGateFiltered).toBe(true)
        expect(result.selectionLayer).toBe('none')
        expect(getLLM).not.toHaveBeenCalled()
      },
    )
  })

  describe('all candidates gate-filtered: null winner with allGateFiltered warning', () => {
    it.each([
      ['strict mode (ok forks pool)', [makeFork(0), makeFork(1)], false],
      [
        'fallback mode (criteria-failed forks pool) — gate absolute over both pools',
        [makeFork(0, 'criteria-failed'), makeFork(1, 'criteria-failed')],
        true,
      ],
    ])('%s', async (_, forks, fallback) => {
      mockContentSequence('', '')
      const result = await makeJudge().selectWinner({
        forks,
        validateNodes: [],
        parentNodeId: 'parent',
        fallback,
      })
      expect(result.winnerForkIndex).toBeNull()
      expect(result.selectionLayer).toBe('none')
      expect(result.noSignal).toBe(false)
      expect(result.tiebreakUsed).toBe(false)
      expect(result.perCriterionVerdict).toEqual([])
      expect(warningConditions(result)).toContain(JUDGE_WARNING_CONDITION.ALL_GATE_FILTERED)
      const warn = result.judgeQualityWarnings.find(w => w.condition === JUDGE_WARNING_CONDITION.ALL_GATE_FILTERED)
      expect(warn.severity).toBe('high')
      expect(result.allGateFiltered).toBe(true)
      expect(result.failureCause).toBe(FAILURE_CAUSE.STRUCTURAL_GATE)
      expect(result.remediationHint).toBe(REMEDIATION_HINT.REVISE_PROMPT)
      expect(getLLM).not.toHaveBeenCalled()
    })

    it('noSignal:false on gate-filtered path distinguishes structural invalidity from juror-signal-loss', async () => {
      mockContentSequence('', '')
      const gateFilteredResult = await makeJudge().selectWinner({
        forks: [makeFork(0), makeFork(1)],
        validateNodes: [],
        parentNodeId: 'parent',
        fallback: false,
      })

      mockLLMError('timeout')
      const jurorSignalLostResult = await makeJudge().selectWinner({
        forks: [makeFork(0), makeFork(1)],
        validateNodes: [],
        parentNodeId: 'parent',
        fallback: false,
      })

      expect(gateFilteredResult.noSignal).toBe(false)
      expect(jurorSignalLostResult.noSignal).toBe(true)
    })
  })

  describe('gate-subset: gate-passing candidates are ranked; original forkIndex values flow through', () => {
    it('gate-passing forks are submitted to judge; winnerForkIndex is from original fork array', async () => {
      mockContentSequence('', SUBSTANTIVE_A, SUBSTANTIVE_B)
      mockLLMRanking('1,2')
      const result = await makeJudge().selectWinner({
        forks: [makeFork(0), makeFork(1), makeFork(2)],
        validateNodes: [],
        parentNodeId: 'parent',
        fallback: false,
      })
      expect(result.winnerForkIndex).toBe(1)
      expect(result.selectionLayer).toBe('primary')
      expect(getLLM).toHaveBeenCalled()
    })

    it('perCriterionVerdict forkRankings carry original forkIndex values, not gate-array positions', async () => {
      mockContentSequence('', SUBSTANTIVE_A, SUBSTANTIVE_B)
      mockLLMRanking('2,1')
      const result = await makeJudge().selectWinner({
        forks: [makeFork(5), makeFork(6), makeFork(7)],
        validateNodes: [makeValidate('v1', 'criterion')],
        parentNodeId: 'parent',
        fallback: false,
      })
      expect(result.winnerForkIndex).toBe(7)
      const rankedIndices = result.perCriterionVerdict[0].forkRankings.map(r => r.forkIndex)
      expect(rankedIndices).toContain(6)
      expect(rankedIndices).toContain(7)
      expect(rankedIndices).not.toContain(5)
    })

    it('judgeInput.candidateCount equals number of gate-passing forks, not total fork count', async () => {
      mockContentSequence('', SUBSTANTIVE_A, SUBSTANTIVE_B)
      mockLLMRanking('1,2')
      const result = await makeJudge().selectWinner({
        forks: [makeFork(0), makeFork(1), makeFork(2)],
        validateNodes: [],
        parentNodeId: 'parent',
        fallback: false,
      })
      expect(result.judgeInput.candidateCount).toBe(2)
    })

    it('judgeQualityWarnings from provider analysis are present alongside ranking result', async () => {
      getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'k'}})
      mockContentSequence('', SUBSTANTIVE_A, SUBSTANTIVE_B)
      mockLLMRanking('1,2')
      const result = await makeJudge().selectWinner({
        forks: [makeFork(0), makeFork(1), makeFork(2)],
        validateNodes: [],
        parentNodeId: 'parent',
        fallback: false,
      })
      expect(warningConditions(result)).toContain(JUDGE_WARNING_CONDITION.SINGLE_PROVIDER)
      expect(warningConditions(result)).not.toContain(JUDGE_WARNING_CONDITION.ALL_GATE_FILTERED)
    })
  })

  it('all forks passing gate: winner determined by judge ranking, candidateCount equals total fork count', async () => {
    mockLLMRanking('2,1')
    const result = await makeJudge().selectWinner({
      forks: [makeFork(0), makeFork(1)],
      validateNodes: [],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.winnerForkIndex).toBe(1)
    expect(result.judgeInput.candidateCount).toBe(2)
    expect(result.selectionLayer).toBe('primary')
    expect(result.noSignal).toBe(false)
    expect(result.allGateFiltered).toBe(false)
  })
})

describe('ForkJudge.selectWinner — structural-gate drift observability', () => {
  const driftCalls = () =>
    require('debug').mock.calls.filter(
      args => typeof args[0] === 'string' && args[0].includes('structural-gate drift signal'),
    )

  const useCandidateContents = contents => {
    let index = 0
    NodeTextExtractor.mockImplementation(() => ({
      extractFullContent: jest.fn().mockImplementation(() => Promise.resolve(contents[index++])),
    }))
  }

  it.each([
    ['I am not permitted to provide that.'],
    ['I will not comply with that request.'],
    ['Policy prevents me from answering.'],
  ])('records drift for refusal-shaped loser: %s', async content => {
    useCandidateContents([content, 'usable answer with concrete details'])
    mockLLMRanking('2,1')

    await makeJudge().selectWinner({
      forks: [makeFork(0), makeFork(1)],
      validateNodes: [makeValidate('v1', 'criterion')],
      parentNodeId: 'parent',
      fallback: false,
    })

    const calls = driftCalls()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual([expect.stringContaining('structural-gate drift signal'), 0, 1, 0, 1])
    expect(calls[0].join(' ')).not.toContain(content)
  })

  it.each([['ordinary lower ranked answer with enough content'], ['Market analysis with valid caveats and numbers']])(
    'does not record drift for ordinary lower-ranked content: %s',
    async content => {
      useCandidateContents([content, 'stronger answer with concrete details'])
      mockLLMRanking('2,1')

      await makeJudge().selectWinner({
        forks: [makeFork(0), makeFork(1)],
        validateNodes: [makeValidate('v1', 'criterion')],
        parentNodeId: 'parent',
        fallback: false,
      })

      expect(driftCalls()).toHaveLength(0)
    },
  )

  it('records every refusal-shaped loser and skips ordinary losers in the same ranking set', async () => {
    useCandidateContents([
      'I must refuse this request.',
      'winning answer with concrete details',
      'ordinary weaker answer with enough content',
      'I am not permitted to answer that.',
    ])
    mockLLMRanking('2,3,1,4')

    await makeJudge().selectWinner({
      forks: [makeFork(0), makeFork(1), makeFork(2), makeFork(3)],
      validateNodes: [makeValidate('v1', 'criterion')],
      parentNodeId: 'parent',
      fallback: false,
    })

    const loggedForkIndices = driftCalls()
      .map(call => call[1])
      .sort()
    expect(loggedForkIndices).toEqual([0, 3])
  })

  it('does not record drift for a refusal-shaped winner', async () => {
    useCandidateContents(['I must refuse this request.', 'ordinary lower-ranked answer with enough content'])
    mockLLMRanking('1,2')

    await makeJudge().selectWinner({
      forks: [makeFork(0), makeFork(1)],
      validateNodes: [makeValidate('v1', 'criterion')],
      parentNodeId: 'parent',
      fallback: false,
    })

    expect(driftCalls()).toHaveLength(0)
  })
})

describe('ForkJudge.selectWinner — resilience and signal propagation', () => {
  it('proceeds without throwing when getIntegrationSettings rejects', async () => {
    getIntegrationSettings.mockRejectedValue(new Error('service unavailable'))
    mockLLMRanking('1,2')
    const result = await makeJudge().selectWinner({
      forks: [makeFork(0), makeFork(1)],
      validateNodes: [],
      parentNodeId: 'parent',
    })
    expect(result).toBeDefined()
    expect(result.winnerForkIndex).not.toBeUndefined()
  })

  it('passes AbortSignal to each juror invoke call when signal is provided', async () => {
    const controller = new AbortController()
    const invoke = jest.fn().mockResolvedValue({content: '1,2'})
    getLLM.mockReturnValue({llm: {invoke}})
    await makeJudge().selectWinner({
      forks: [makeFork(0), makeFork(1)],
      validateNodes: [],
      parentNodeId: 'parent',
      signal: controller.signal,
    })
    expect(invoke).toHaveBeenCalledWith(expect.anything(), {
      signal: controller.signal,
    })
  })

  it('requests a non-null thinking budget from LLM when judgeReasoningRequested is true', async () => {
    let capturedBudget
    getLLM.mockImplementation(({thinkingBudgetTokens}) => {
      capturedBudget = thinkingBudgetTokens
      return {
        llm: {invoke: jest.fn().mockResolvedValue({content: '1,2'})},
      }
    })
    await makeJudge().selectWinner({
      forks: [makeFork(0), makeFork(1)],
      validateNodes: [],
      parentNodeId: 'parent',
      judgeReasoningRequested: true,
    })
    expect(capturedBudget).not.toBeNull()
    expect(typeof capturedBudget).toBe('number')
  })

  it('omits generatorOnlyJudge from noSignal result when multiple providers are configured', async () => {
    getIntegrationSettings.mockResolvedValue({
      openai: {apiKey: 'k'},
      claude: {apiKey: 'k'},
    })
    mockLLMError('timeout')
    const result = await makeJudge().selectWinner({
      forks: [makeFork(0), makeFork(1)],
      validateNodes: [makeValidate('v1', 'criterion')],
      parentNodeId: 'parent',
      fallback: false,
    })
    expect(result.noSignal).toBe(true)
    expect(result.generatorOnlyJudge).toBeUndefined()
  })

  it('returns mode fallback when exactly one fork candidate survives in fallback mode', async () => {
    const result = await makeJudge().selectWinner({
      forks: [makeFork(0, 'criteria-failed'), makeFork(1, 'runtime-failed', {reason: 'err', forkStore: null})],
      validateNodes: [],
      parentNodeId: 'parent',
      fallback: true,
    })
    expect(result.winnerForkIndex).toBe(0)
    expect(result.mode).toBe('fallback')
    expect(getLLM).not.toHaveBeenCalled()
  })

  it('applies allGateFiltered when every fork store lacks the parent node', async () => {
    const emptyForkStore = buildStore({})
    const forks = [
      {forkIndex: 0, status: 'ok', forkStore: emptyForkStore},
      {forkIndex: 1, status: 'ok', forkStore: emptyForkStore},
    ]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [],
      parentNodeId: 'parent',
    })
    expect(result.allGateFiltered).toBe(true)
    expect(result.winnerForkIndex).toBeNull()
  })
})

describe('ForkJudge.selectWinner — fallbackWithWeakJudge via lowest-tier-only providers', () => {
  it('emits fallbackWithWeakJudge when fallback selection runs on a lowest-tier-only provider set', async () => {
    getIntegrationSettings.mockResolvedValue({
      yandex: {apiKey: 'k'},
      custom_llm: {apiRootUrl: 'http://x'},
    })
    mockLLMRanking('1,2')
    const result = await makeJudge().selectWinner({
      forks: [makeFork(0, 'criteria-failed'), makeFork(1, 'criteria-failed')],
      validateNodes: [makeValidate('v1', 'quality', 1)],
      parentNodeId: 'parent',
      fallback: true,
    })
    expect(warningConditions(result)).toContain(JUDGE_WARNING_CONDITION.FALLBACK_WITH_WEAK_JUDGE)
    const warn = result.judgeQualityWarnings.find(w => w.condition === JUDGE_WARNING_CONDITION.FALLBACK_WITH_WEAK_JUDGE)
    expect(warn.severity).toBe('high')
  })
})

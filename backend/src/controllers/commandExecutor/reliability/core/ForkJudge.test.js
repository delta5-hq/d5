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

const mockLLMRankingWithChunkSize = (ranking, chunkSize) => {
  const invoke = jest.fn().mockResolvedValue({content: ranking})
  getLLM.mockReturnValue({llm: {invoke}, chunkSize})
  return invoke
}

const mockLLMError = message => {
  getLLM.mockReturnValue({llm: {invoke: jest.fn().mockRejectedValue(new Error(message))}})
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

  it('model resolution failure excludes only that juror when another juror produces a ranking', async () => {
    getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'k'}, claude: {apiKey: 'k'}})
    getLLM
      .mockImplementationOnce(() => {
        throw new Error('model unavailable')
      })
      .mockReturnValueOnce({llm: {invoke: jest.fn().mockResolvedValue({content: '2,1'})}, chunkSize: 200_000})

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
    const conditions = warningConditions(result)
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
    const conditions = warningConditions(result)
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
    const conditions = warningConditions(result)
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
    const conditions = warningConditions(result)
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
    const conditions = warningConditions(result)
    expect(conditions).toContain('lowestTierOnly')
    expect(conditions).toContain('noReasoningMode')
    const warn = result.judgeQualityWarnings.find(w => w.condition === 'lowestTierOnly')
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
    const conditions = warningConditions(result)
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
    const conditions = warningConditions(result)
    expect(conditions).not.toContain('degradedInput')
  })

  it('degradedInput uses the resolved judge model chunkSize, not the provider family default', async () => {
    getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'k', model: 'small-context-test-model'}})
    mockLLMRankingWithChunkSize('2,1', 1_000)
    const forks = [makeFork(0), makeFork(1)]
    const result = await makeJudge().selectWinner({
      forks,
      validateNodes: [],
      parentNodeId: 'parent',
      fallback: false,
    })

    const conditions = warningConditions(result)
    expect(conditions).toContain('degradedInput')
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
    expect(warningConditions(result)).toContain('juryDuplicates')
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
    getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'k'}, claude: {apiKey: 'k'}})
    NodeTextExtractor.mockImplementation(() => ({
      extractFullContent: jest.fn().mockResolvedValue('x'.repeat(10_000)),
    }))
    const largeContextInvoke = jest.fn().mockResolvedValue({content: '1,2'})
    const smallContextInvoke = jest.fn().mockResolvedValue({content: '2,1'})
    getLLM
      .mockReturnValueOnce({llm: {invoke: largeContextInvoke}, chunkSize: 200_000})
      .mockReturnValueOnce({llm: {invoke: smallContextInvoke}, chunkSize: 1_000})
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

// ─── Structural-gate false-negative observability ────────────────────────────

describe('structural-gate false-negative observability', () => {
  const observabilityCalls = () =>
    require('debug').mock.calls.filter(
      args => typeof args[0] === 'string' && args[0].includes('structural-gate false-negative?'),
    )

  it('fork strictly worse than winner receives one log entry carrying its forkIndex', async () => {
    // "2,1": fork-0 rank=1, fork-1 rank=0 → Borda fork-0=1, fork-1=0
    // fork-1 wins (score 0); fork-0 score 1 > winnerScore 0 → logged
    mockLLMRanking('2,1')
    await makeJudge().selectWinner({
      forks: [makeFork(0), makeFork(1)],
      validateNodes: [makeValidate('v1', 'criterion')],
      parentNodeId: 'parent',
      fallback: false,
    })

    const calls = observabilityCalls()
    expect(calls).toHaveLength(1)
    expect(calls[0][1]).toBe(0)
  })

  it('winner fork never appears in observability log', async () => {
    // "2,1" → fork-1 wins (Borda score 0); its forkIndex must not appear in log
    mockLLMRanking('2,1')
    await makeJudge().selectWinner({
      forks: [makeFork(0), makeFork(1)],
      validateNodes: [makeValidate('v1', 'criterion')],
      parentNodeId: 'parent',
      fallback: false,
    })

    const loggedForkIndices = observabilityCalls().map(c => c[1])
    expect(loggedForkIndices).not.toContain(1)
  })

  it('fork tied at winner Borda score does not trigger observability', async () => {
    // juror-1: '1,2' → fork-0 score 0, fork-1 score 1
    // juror-2: '2,1' → fork-0 score 1, fork-1 score 0
    // totals: fork-0=1, fork-1=1 — complete tie; no fork is strictly worse than winner
    getLLM
      .mockReturnValueOnce({llm: {invoke: jest.fn().mockResolvedValue({content: '1,2'})}})
      .mockReturnValueOnce({llm: {invoke: jest.fn().mockResolvedValue({content: '2,1'})}})
    getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'k'}, claude: {apiKey: 'c'}})
    await makeJudge().selectWinner({
      forks: [makeFork(0), makeFork(1)],
      validateNodes: [makeValidate('v1', 'criterion', 2)],
      parentNodeId: 'parent',
      fallback: false,
    })

    expect(observabilityCalls()).toHaveLength(0)
  })

  it('each fork strictly worse than winner gets its own log entry', async () => {
    // "1,3,2": fork-0 rank=0, fork-1 rank=2, fork-2 rank=1 → Borda fork-0=0, fork-1=2, fork-2=1
    // fork-1 and fork-2 both > winnerScore 0 → both logged
    mockLLMRanking('1,3,2')
    await makeJudge().selectWinner({
      forks: [makeFork(0), makeFork(1), makeFork(2)],
      validateNodes: [makeValidate('v1', 'criterion')],
      parentNodeId: 'parent',
      fallback: false,
    })

    const calls = observabilityCalls()
    expect(calls).toHaveLength(2)
    const loggedForkIndices = calls.map(c => c[1]).sort()
    expect(loggedForkIndices).toEqual([1, 2])
  })

  it('content preview is capped at 120 chars with newlines replaced by spaces', async () => {
    const longContent = 'A'.repeat(80) + '\n' + 'B'.repeat(80)
    NodeTextExtractor.mockImplementation(() => ({
      extractFullContent: jest.fn().mockResolvedValue(longContent),
    }))
    mockLLMRanking('2,1')
    await makeJudge().selectWinner({
      forks: [makeFork(0), makeFork(1)],
      validateNodes: [makeValidate('v1', 'criterion')],
      parentNodeId: 'parent',
      fallback: false,
    })

    const calls = observabilityCalls()
    expect(calls).toHaveLength(1)
    const preview = calls[0][4]
    expect(preview.length).toBeLessThanOrEqual(120)
    expect(preview).not.toContain('\n')
    expect(preview).toBe(longContent.slice(0, 120).replace(/\n/g, ' '))
  })

  it.each([
    ['strict mode — early return before observability block', false],
    ['fallback mode — all Borda scores zero so no fork is strictly worse than winner', true],
  ])('does not log when all jurors are excluded and no ranking signal exists (%s)', async (_, fallback) => {
    mockLLMError('invoke failed')
    await makeJudge().selectWinner({
      forks: [makeFork(0), makeFork(1)],
      validateNodes: [makeValidate('v1', 'criterion')],
      parentNodeId: 'parent',
      fallback,
    })

    expect(observabilityCalls()).toHaveLength(0)
  })

  it('single eligible fork does not trigger observability (no peer comparison possible)', async () => {
    await makeJudge().selectWinner({
      forks: [makeFork(0)],
      validateNodes: [makeValidate('v1', 'criterion')],
      parentNodeId: 'parent',
      fallback: false,
    })

    expect(observabilityCalls()).toHaveLength(0)
  })
})

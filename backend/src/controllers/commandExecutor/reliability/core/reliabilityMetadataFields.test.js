import {DEGRADED_INPUT_THRESHOLD_CHARS} from './judgeContentBudget'
import {JUDGE_WARNING_CONDITION} from './failureSemantics'
import {
  buildReliabilityMetadata,
  buildCommodityReliabilityMetadata,
  buildInvalidReliabilityMetadata,
  buildDiscardedFork,
  buildJudgeInputMetadata,
  buildJudgeQualityWarning,
  buildForkRankingEntry,
  buildPerCriterionVerdictEntry,
  COMMODITY_PARTIAL_SUCCESS_WARNING,
  buildValidateRetryWithheldReliabilityMetadata,
} from './reliabilityMetadataFields'

const minimalVerdict = {
  winnerForkIndex: 0,
  mode: 'strict',
  selectionLayer: 'primary',
}

describe('buildReliabilityMetadata', () => {
  describe('required fields are copied from verdict and arguments without transformation', () => {
    it.each([
      ['strict', 'primary'],
      ['fallback', 'fallback'],
    ])('mode %s and selectionLayer %s pass through unchanged', (mode, selectionLayer) => {
      const meta = buildReliabilityMetadata({...minimalVerdict, mode, selectionLayer}, [], 0, 1)
      expect(meta.mode).toBe(mode)
      expect(meta.selectionLayer).toBe(selectionLayer)
    })

    it.each([0, 1, 5])('winnerForkIndex %i appears in output (zero is a valid winner)', idx => {
      const meta = buildReliabilityMetadata({...minimalVerdict, winnerForkIndex: idx}, [], 0, 1)
      expect(meta.winnerForkIndex).toBe(idx)
    })

    it('winnerForkIndex: null passes through as null, not undefined', () => {
      const meta = buildReliabilityMetadata({...minimalVerdict, winnerForkIndex: null}, [], 0, 2)
      expect(meta.winnerForkIndex).toBeNull()
      expect('winnerForkIndex' in meta).toBe(true)
    })

    it('eligible reflects okCount argument, not forkResults length', () => {
      const meta = buildReliabilityMetadata(
        minimalVerdict,
        [
          {forkIndex: 0, status: 'ok'},
          {forkIndex: 1, status: 'criteria-failed'},
        ],
        1,
        3,
      )
      expect(meta.eligible).toBe(1)
    })

    it('total reflects n argument, not forkResults length', () => {
      const meta = buildReliabilityMetadata(minimalVerdict, [{forkIndex: 0, status: 'ok'}], 0, 5)
      expect(meta.total).toBe(5)
    })
  })

  describe('optional fields default to safe values when absent from verdict', () => {
    it.each([
      ['perCriterionVerdict', []],
      ['noSignal', false],
      ['tiebreakUsed', false],
      ['judgeQualityWarnings', []],
    ])('%s defaults to %p when verdict does not provide it', (field, expected) => {
      const meta = buildReliabilityMetadata(minimalVerdict, [], 0, 1)
      expect(meta[field]).toStrictEqual(expected)
    })

    it('judgeInput is absent from JSON output when verdict does not provide it', () => {
      const meta = buildReliabilityMetadata(minimalVerdict, [], 0, 1)
      expect(JSON.parse(JSON.stringify(meta))).not.toHaveProperty('judgeInput')
    })

    it.each(['failureCause', 'remediationHint', 'allGateFiltered'])(
      '%s is absent from JSON output when verdict does not provide it',
      field => {
        const meta = buildReliabilityMetadata(minimalVerdict, [], 0, 1)
        expect(JSON.parse(JSON.stringify(meta))).not.toHaveProperty(field)
      },
    )
  })

  describe('optional fields pass through from verdict when provided', () => {
    const criteria = [
      {
        criterionId: 'v1',
        criterion: 'must include numbers',
        forkRankings: [],
      },
    ]
    const judgeInput = {
      candidateCount: 2,
      perForkBudgetChars: 5000,
      degradedInput: false,
      resolvedJudgeFamilies: ['openai'],
    }
    const warnings = [{condition: 'singleProvider', severity: 'high'}]
    const failureFields = {
      failureCause: 'structural-gate',
      remediationHint: 'revise-prompt',
      allGateFiltered: true,
    }

    it('perCriterionVerdict array is preserved when set', () => {
      const meta = buildReliabilityMetadata({...minimalVerdict, perCriterionVerdict: criteria}, [], 0, 1)
      expect(meta.perCriterionVerdict).toBe(criteria)
    })

    it('noSignal: true passes through', () => {
      const meta = buildReliabilityMetadata({...minimalVerdict, noSignal: true}, [], 0, 1)
      expect(meta.noSignal).toBe(true)
    })

    it('tiebreakUsed: true passes through', () => {
      const meta = buildReliabilityMetadata({...minimalVerdict, tiebreakUsed: true}, [], 0, 1)
      expect(meta.tiebreakUsed).toBe(true)
    })

    it('judgeInput object passes through when set', () => {
      const meta = buildReliabilityMetadata({...minimalVerdict, judgeInput}, [], 0, 1)
      expect(meta.judgeInput).toBe(judgeInput)
    })

    it('judgeQualityWarnings array is preserved when set', () => {
      const meta = buildReliabilityMetadata({...minimalVerdict, judgeQualityWarnings: warnings}, [], 0, 1)
      expect(meta.judgeQualityWarnings).toBe(warnings)
    })

    it('failure semantics fields pass through when set', () => {
      const meta = buildReliabilityMetadata({...minimalVerdict, ...failureFields}, [], 0, 1)
      expect(meta).toEqual(expect.objectContaining(failureFields))
    })

    it('suppression evidence is copied from executed fork results, not from the judge verdict', () => {
      const meta = buildReliabilityMetadata(
        minimalVerdict,
        [
          {
            forkIndex: 0,
            status: 'ok',
            suppressed: true,
            cause: 'side-effecting-alias',
            requestedN: 5,
          },
        ],
        1,
        5,
      )

      expect(meta).toEqual(
        expect.objectContaining({
          suppressed: true,
          cause: 'side-effecting-alias',
          requestedN: 5,
        }),
      )
    })

    it('suppression evidence is absent when no executed fork was suppressed', () => {
      const meta = buildReliabilityMetadata(minimalVerdict, [{forkIndex: 0, status: 'ok'}], 1, 1)

      expect(meta.suppressed).toBeUndefined()
      expect(meta.cause).toBeUndefined()
      expect(meta.requestedN).toBeUndefined()
    })

    it('retryWithheld: true passes through from verdict', () => {
      const meta = buildReliabilityMetadata({...minimalVerdict, retryWithheld: true}, [], 0, 1)

      expect(meta.retryWithheld).toBe(true)
    })

    it('retryWithheld is absent from output when verdict does not set it', () => {
      const meta = buildReliabilityMetadata(minimalVerdict, [], 0, 1)

      expect(meta.retryWithheld).toBeUndefined()
    })

    it('requestedRetry passes through from verdict when set', () => {
      const meta = buildReliabilityMetadata({...minimalVerdict, requestedRetry: 3}, [], 0, 1)

      expect(meta.requestedRetry).toBe(3)
    })

    it('requestedRetry is absent from output when verdict does not set it', () => {
      const meta = buildReliabilityMetadata(minimalVerdict, [], 0, 1)

      expect(meta.requestedRetry).toBeUndefined()
    })
  })

  describe('discardedForks excludes the winner and includes all other forks', () => {
    const threeForks = [
      {forkIndex: 0, status: 'ok'},
      {forkIndex: 1, status: 'ok'},
      {forkIndex: 2, status: 'ok'},
    ]

    it.each([0, 1, 2])('winner at forkIndex %i is excluded from discardedForks', winnerIdx => {
      const meta = buildReliabilityMetadata({...minimalVerdict, winnerForkIndex: winnerIdx}, threeForks, 1, 3)
      expect(meta.discardedForks.map(f => f.forkIndex)).not.toContain(winnerIdx)
      expect(meta.discardedForks).toHaveLength(2)
    })

    it('non-winner forks appear in the same relative order as in forkResults', () => {
      const meta = buildReliabilityMetadata({...minimalVerdict, winnerForkIndex: 1}, threeForks, 1, 3)
      expect(meta.discardedForks.map(f => f.forkIndex)).toEqual([0, 2])
    })

    it('is empty when forkResults contains only the winner', () => {
      const meta = buildReliabilityMetadata(minimalVerdict, [{forkIndex: 0, status: 'ok'}], 1, 1)
      expect(meta.discardedForks).toEqual([])
    })

    it('is empty when forkResults is empty', () => {
      const meta = buildReliabilityMetadata(minimalVerdict, [], 0, 0)
      expect(meta.discardedForks).toEqual([])
    })

    it('all forks appear in discardedForks when winnerForkIndex is null (no-winner path)', () => {
      const forks = [
        {forkIndex: 0, status: 'ok'},
        {forkIndex: 1, status: 'criteria-failed'},
      ]
      const meta = buildReliabilityMetadata({...minimalVerdict, winnerForkIndex: null}, forks, 0, 2)
      expect(meta.discardedForks.map(f => f.forkIndex)).toEqual([0, 1])
    })
  })

  describe('discardedForks entries reflect each non-winner fork through buildDiscardedFork', () => {
    it('criteria-failed fork carries failedAt and attempts through to discardedForks entry', () => {
      const loser = {
        forkIndex: 1,
        status: 'criteria-failed',
        failedAt: 'must include numbers',
        attempts: 3,
      }
      const meta = buildReliabilityMetadata(minimalVerdict, [{forkIndex: 0, status: 'ok'}, loser], 1, 2)
      expect(meta.discardedForks[0]).toEqual({
        forkIndex: 1,
        status: 'criteria-failed',
        failedAt: 'must include numbers',
        attempts: 3,
      })
    })

    it('runtime-failed fork carries reason and omits failedAt and attempts', () => {
      const loser = {
        forkIndex: 1,
        status: 'runtime-failed',
        reason: 'context deadline exceeded',
      }
      const meta = buildReliabilityMetadata(minimalVerdict, [{forkIndex: 0, status: 'ok'}, loser], 1, 2)
      expect(meta.discardedForks[0]).toEqual({
        forkIndex: 1,
        status: 'runtime-failed',
        reason: 'context deadline exceeded',
      })
    })
  })
})

describe('buildDiscardedFork', () => {
  describe('required fields always appear regardless of value', () => {
    it.each([0, 1, 9])('forkIndex %i appears in output (zero is a valid loser index)', idx => {
      expect(buildDiscardedFork({forkIndex: idx, status: 'ok'})).toHaveProperty('forkIndex', idx)
    })

    it.each(['ok', 'criteria-failed', 'runtime-failed', ''])('status %p appears in output', status => {
      expect(buildDiscardedFork({forkIndex: 1, status})).toHaveProperty('status', status)
    })
  })

  describe('optional fields are present only when their input value is not undefined', () => {
    it('failedAt appears when defined', () => {
      expect(
        buildDiscardedFork({
          forkIndex: 1,
          status: 'criteria-failed',
          failedAt: 'criterion',
        }),
      ).toHaveProperty('failedAt', 'criterion')
    })

    it('failedAt is absent when undefined', () => {
      expect(buildDiscardedFork({forkIndex: 1, status: 'ok'})).not.toHaveProperty('failedAt')
    })

    it('reason appears when defined', () => {
      expect(
        buildDiscardedFork({
          forkIndex: 1,
          status: 'runtime-failed',
          reason: 'timeout',
        }),
      ).toHaveProperty('reason', 'timeout')
    })

    it('reason is absent when undefined', () => {
      expect(buildDiscardedFork({forkIndex: 1, status: 'ok'})).not.toHaveProperty('reason')
    })

    it('attempts appears when defined', () => {
      expect(
        buildDiscardedFork({
          forkIndex: 1,
          status: 'criteria-failed',
          attempts: 3,
        }),
      ).toHaveProperty('attempts', 3)
    })

    it('attempts is absent when undefined', () => {
      expect(buildDiscardedFork({forkIndex: 1, status: 'ok'})).not.toHaveProperty('attempts')
    })
  })

  describe('zero and empty-string optional values are defined (not equivalent to undefined)', () => {
    it('attempts: 0 appears in output', () => {
      expect(
        buildDiscardedFork({
          forkIndex: 1,
          status: 'criteria-failed',
          attempts: 0,
        }),
      ).toHaveProperty('attempts', 0)
    })

    it('failedAt: "" appears in output', () => {
      expect(
        buildDiscardedFork({
          forkIndex: 1,
          status: 'criteria-failed',
          failedAt: '',
        }),
      ).toHaveProperty('failedAt', '')
    })

    it('reason: "" appears in output', () => {
      expect(
        buildDiscardedFork({
          forkIndex: 1,
          status: 'runtime-failed',
          reason: '',
        }),
      ).toHaveProperty('reason', '')
    })
  })

  describe('output key set is exactly {required} ∪ {defined optionals}', () => {
    it('contains only forkIndex and status when no optionals are defined', () => {
      expect(Object.keys(buildDiscardedFork({forkIndex: 1, status: 'ok'})).sort()).toEqual(['forkIndex', 'status'])
    })

    it.each([
      [{failedAt: 'x'}, ['failedAt', 'forkIndex', 'status']],
      [{reason: 'y'}, ['forkIndex', 'reason', 'status']],
      [{attempts: 3}, ['attempts', 'forkIndex', 'status']],
      [{failedAt: 'x', reason: 'y'}, ['failedAt', 'forkIndex', 'reason', 'status']],
      [{failedAt: 'x', attempts: 3}, ['attempts', 'failedAt', 'forkIndex', 'status']],
      [{reason: 'y', attempts: 3}, ['attempts', 'forkIndex', 'reason', 'status']],
    ])('with optionals %p produces exactly keys %p', (optionals, expectedKeys) => {
      const result = buildDiscardedFork({
        forkIndex: 1,
        status: 'criteria-failed',
        ...optionals,
      })
      expect(Object.keys(result).sort()).toEqual(expectedKeys)
    })

    it('contains all 5 keys when all optionals are defined', () => {
      const result = buildDiscardedFork({
        forkIndex: 1,
        status: 'criteria-failed',
        failedAt: 'x',
        reason: 'y',
        attempts: 3,
      })
      expect(Object.keys(result).sort()).toEqual(['attempts', 'failedAt', 'forkIndex', 'reason', 'status'])
    })
  })
})

describe('buildJudgeInputMetadata', () => {
  describe('field names and pass-through', () => {
    it.each([0, 1, 3])('candidateCount %i passes through unchanged (zero is valid)', count => {
      const result = buildJudgeInputMetadata({
        candidateCount: count,
        perForkBudget: 5000,
        resolvedModels: [],
      })
      expect(result.candidateCount).toBe(count)
    })

    it('perForkBudget is exposed as perForkBudgetChars', () => {
      const result = buildJudgeInputMetadata({
        candidateCount: 1,
        perForkBudget: 12345,
        resolvedModels: [],
      })
      expect(result.perForkBudgetChars).toBe(12345)
      expect(result).not.toHaveProperty('perForkBudget')
    })
  })

  describe('degradedInput reflects the isDegradedInput threshold', () => {
    it('is true when perForkBudget is at the threshold (boundary)', () => {
      const result = buildJudgeInputMetadata({
        candidateCount: 1,
        perForkBudget: DEGRADED_INPUT_THRESHOLD_CHARS,
        resolvedModels: [],
      })
      expect(result.degradedInput).toBe(true)
    })

    it('is true when perForkBudget is below the threshold', () => {
      const result = buildJudgeInputMetadata({
        candidateCount: 1,
        perForkBudget: DEGRADED_INPUT_THRESHOLD_CHARS - 1,
        resolvedModels: [],
      })
      expect(result.degradedInput).toBe(true)
    })

    it('is false when perForkBudget is above the threshold', () => {
      const result = buildJudgeInputMetadata({
        candidateCount: 1,
        perForkBudget: DEGRADED_INPUT_THRESHOLD_CHARS + 1,
        resolvedModels: [],
      })
      expect(result.degradedInput).toBe(false)
    })
  })

  describe('resolvedJudgeFamilies', () => {
    it('deduplicates models that share the same family', () => {
      const models = [{judgeFamily: 'openai'}, {judgeFamily: 'claude'}, {judgeFamily: 'openai'}]
      const result = buildJudgeInputMetadata({
        candidateCount: 2,
        perForkBudget: 5000,
        resolvedModels: models,
      })
      expect(result.resolvedJudgeFamilies.sort()).toEqual(['claude', 'openai'])
    })

    it('preserves first-seen order after deduplication', () => {
      const models = [{judgeFamily: 'claude'}, {judgeFamily: 'openai'}, {judgeFamily: 'claude'}]
      const result = buildJudgeInputMetadata({
        candidateCount: 2,
        perForkBudget: 5000,
        resolvedModels: models,
      })
      expect(result.resolvedJudgeFamilies).toEqual(['claude', 'openai'])
    })

    it('filters out null and undefined judgeFamily values', () => {
      const models = [{judgeFamily: 'openai'}, {judgeFamily: null}, {judgeFamily: undefined}]
      const result = buildJudgeInputMetadata({
        candidateCount: 2,
        perForkBudget: 5000,
        resolvedModels: models,
      })
      expect(result.resolvedJudgeFamilies).toEqual(['openai'])
    })

    it('filters out empty-string judgeFamily (falsy)', () => {
      const models = [{judgeFamily: 'openai'}, {judgeFamily: ''}]
      const result = buildJudgeInputMetadata({
        candidateCount: 2,
        perForkBudget: 5000,
        resolvedModels: models,
      })
      expect(result.resolvedJudgeFamilies).toEqual(['openai'])
    })

    it('returns empty array when resolvedModels is empty', () => {
      const result = buildJudgeInputMetadata({
        candidateCount: 0,
        perForkBudget: 5000,
        resolvedModels: [],
      })
      expect(result.resolvedJudgeFamilies).toEqual([])
    })

    it('returns empty array when all models have falsy family values', () => {
      const models = [{judgeFamily: null}, {judgeFamily: undefined}, {judgeFamily: ''}]
      const result = buildJudgeInputMetadata({
        candidateCount: 3,
        perForkBudget: 5000,
        resolvedModels: models,
      })
      expect(result.resolvedJudgeFamilies).toEqual([])
    })
  })

  describe('output key set is exactly the four declared fields', () => {
    it('contains exactly candidateCount, perForkBudgetChars, degradedInput, resolvedJudgeFamilies', () => {
      const result = buildJudgeInputMetadata({
        candidateCount: 1,
        perForkBudget: 5000,
        resolvedModels: [],
      })
      expect(Object.keys(result).sort()).toEqual([
        'candidateCount',
        'degradedInput',
        'perForkBudgetChars',
        'resolvedJudgeFamilies',
      ])
    })
  })
})

describe('buildJudgeQualityWarning', () => {
  it('condition and severity pass through unchanged', () => {
    const result = buildJudgeQualityWarning({
      condition: 'singleProvider',
      severity: 'high',
    })
    expect(result).toEqual({condition: 'singleProvider', severity: 'high'})
  })

  it.each(['high', 'medium', 'low'])('severity %p is preserved', severity => {
    const result = buildJudgeQualityWarning({condition: 'x', severity})
    expect(result.severity).toBe(severity)
  })

  it('output key set is exactly {condition, severity}', () => {
    expect(Object.keys(buildJudgeQualityWarning({condition: 'x', severity: 'high'})).sort()).toEqual([
      'condition',
      'severity',
    ])
  })
})

describe('buildForkRankingEntry', () => {
  it('forkIndex and rank pass through unchanged', () => {
    expect(buildForkRankingEntry({forkIndex: 2, rank: 1})).toEqual({
      forkIndex: 2,
      rank: 1,
    })
  })

  it.each([0, 1, 5])('forkIndex %i is preserved (zero is a valid fork index)', idx => {
    expect(buildForkRankingEntry({forkIndex: idx, rank: 1})).toHaveProperty('forkIndex', idx)
  })

  it.each([0, 1, 3])('rank %i is preserved (zero is falsy but valid)', rank => {
    expect(buildForkRankingEntry({forkIndex: 0, rank})).toHaveProperty('rank', rank)
  })

  it('output key set is exactly {forkIndex, rank}', () => {
    expect(Object.keys(buildForkRankingEntry({forkIndex: 0, rank: 1})).sort()).toEqual(['forkIndex', 'rank'])
  })
})

describe('buildPerCriterionVerdictEntry', () => {
  const rankings = [
    {forkIndex: 0, rank: 1},
    {forkIndex: 1, rank: 2},
  ]

  it('criterionId, criterion, and forkRankings pass through by reference', () => {
    const result = buildPerCriterionVerdictEntry({
      criterionId: 'v1',
      criterion: 'must cite sources',
      forkRankings: rankings,
    })
    expect(result.criterionId).toBe('v1')
    expect(result.criterion).toBe('must cite sources')
    expect(result.forkRankings).toBe(rankings)
  })

  it('empty-string criterionId is preserved (not treated as falsy)', () => {
    const result = buildPerCriterionVerdictEntry({
      criterionId: '',
      criterion: 'x',
      forkRankings: [],
    })
    expect(result.criterionId).toBe('')
  })

  it('empty forkRankings array is preserved', () => {
    const result = buildPerCriterionVerdictEntry({
      criterionId: 'v1',
      criterion: 'x',
      forkRankings: [],
    })
    expect(result.forkRankings).toEqual([])
  })

  it('output key set is exactly {criterionId, criterion, forkRankings}', () => {
    const result = buildPerCriterionVerdictEntry({
      criterionId: 'v1',
      criterion: 'x',
      forkRankings: [],
    })
    expect(Object.keys(result).sort()).toEqual(['criterion', 'criterionId', 'forkRankings'])
  })
})

describe('COMMODITY_PARTIAL_SUCCESS_WARNING', () => {
  it('condition equals JUDGE_WARNING_CONDITION.COMMODITY_PARTIAL_SUCCESS', () => {
    expect(COMMODITY_PARTIAL_SUCCESS_WARNING.condition).toBe(JUDGE_WARNING_CONDITION.COMMODITY_PARTIAL_SUCCESS)
  })

  it('severity is medium', () => {
    expect(COMMODITY_PARTIAL_SUCCESS_WARNING.severity).toBe('medium')
  })

  it('shape is exactly {condition, severity} — no extra keys', () => {
    expect(Object.keys(COMMODITY_PARTIAL_SUCCESS_WARNING).sort()).toEqual(['condition', 'severity'])
  })

  it('is frozen — properties cannot be mutated at runtime', () => {
    const original = {...COMMODITY_PARTIAL_SUCCESS_WARNING}
    try {
      COMMODITY_PARTIAL_SUCCESS_WARNING.condition = 'mutated'
    } catch {
      // strict mode throws; non-strict mode silently ignores — both are valid
    }
    expect(COMMODITY_PARTIAL_SUCCESS_WARNING.condition).toBe(original.condition)
  })
})

describe('buildReliabilityMetadata — fallbackUsed field', () => {
  const baseVerdict = {
    winnerForkIndex: 1,
    mode: 'fallback',
    selectionLayer: 'primary',
  }

  it('omits fallbackUsed when selectionLayer is primary', () => {
    const meta = buildReliabilityMetadata(baseVerdict, [], 0, 1)
    expect(meta).not.toHaveProperty('fallbackUsed')
  })

  it('emits fallbackUsed: true when selectionLayer is fallback', () => {
    const meta = buildReliabilityMetadata({...baseVerdict, selectionLayer: 'fallback'}, [], 0, 1)
    expect(meta.fallbackUsed).toBe(true)
  })

  it('omits fallbackUsed when selectionLayer is anything other than fallback', () => {
    for (const layer of ['primary', 'tiebreak', 'judge']) {
      const meta = buildReliabilityMetadata({...baseVerdict, selectionLayer: layer}, [], 0, 1)
      expect(meta).not.toHaveProperty('fallbackUsed')
    }
  })
})

describe('buildCommodityReliabilityMetadata', () => {
  const twoForks = [
    {forkIndex: 0, succeeded: true},
    {forkIndex: 1, succeeded: false},
  ]
  const allSucceededForks = [
    {forkIndex: 0, succeeded: true},
    {forkIndex: 1, succeeded: true},
  ]
  const allFailedForks = [
    {forkIndex: 0, succeeded: false},
    {forkIndex: 1, succeeded: false},
  ]

  it('sets mode to commodity and selectionLayer to primary', () => {
    const meta = buildCommodityReliabilityMetadata({
      successCount: 1,
      total: 2,
      forkOutcomes: twoForks,
    })
    expect(meta.mode).toBe('commodity')
    expect(meta.selectionLayer).toBe('primary')
  })

  it('sets winnerForkIndex to null (no winner in commodity mode)', () => {
    const meta = buildCommodityReliabilityMetadata({
      successCount: 1,
      total: 2,
      forkOutcomes: twoForks,
    })
    expect(meta.winnerForkIndex).toBeNull()
  })

  it('sets eligible to successCount and total to total', () => {
    const meta = buildCommodityReliabilityMetadata({
      successCount: 2,
      total: 3,
      forkOutcomes: twoForks,
    })
    expect(meta.eligible).toBe(2)
    expect(meta.total).toBe(3)
  })

  it('sets noSignal to false', () => {
    const meta = buildCommodityReliabilityMetadata({
      successCount: 1,
      total: 1,
      forkOutcomes: twoForks,
    })
    expect(meta.noSignal).toBe(false)
  })

  it('sets tiebreakUsed to false', () => {
    const meta = buildCommodityReliabilityMetadata({
      successCount: 1,
      total: 1,
      forkOutcomes: twoForks,
    })
    expect(meta.tiebreakUsed).toBe(false)
  })

  it('sets perCriterionVerdict to empty array', () => {
    const meta = buildCommodityReliabilityMetadata({
      successCount: 1,
      total: 1,
      forkOutcomes: twoForks,
    })
    expect(meta.perCriterionVerdict).toEqual([])
  })

  it('discardedForks contains only failed forks with runtime-failed status', () => {
    const meta = buildCommodityReliabilityMetadata({
      successCount: 1,
      total: 2,
      forkOutcomes: twoForks,
    })
    expect(meta.discardedForks).toHaveLength(1)
    expect(meta.discardedForks[0].forkIndex).toBe(1)
    expect(meta.discardedForks[0].status).toBe('runtime-failed')
  })

  it('discardedForks is empty when all forks succeeded', () => {
    const meta = buildCommodityReliabilityMetadata({
      successCount: 2,
      total: 2,
      forkOutcomes: allSucceededForks,
    })
    expect(meta.discardedForks).toEqual([])
  })

  it('discardedForks includes all forks when all failed', () => {
    const allFailed = [
      {forkIndex: 0, succeeded: false},
      {forkIndex: 1, succeeded: false},
      {forkIndex: 2, succeeded: false},
    ]
    const meta = buildCommodityReliabilityMetadata({
      successCount: 0,
      total: 3,
      forkOutcomes: allFailed,
    })
    expect(meta.discardedForks).toHaveLength(3)
    expect(meta.discardedForks.map(d => d.forkIndex)).toEqual([0, 1, 2])
  })

  it('output key set matches commodity contract for full success', () => {
    const meta = buildCommodityReliabilityMetadata({
      successCount: 2,
      total: 2,
      forkOutcomes: allSucceededForks,
    })
    expect(Object.keys(meta).sort()).toEqual(
      [
        'discardedForks',
        'eligible',
        'mode',
        'noSignal',
        'perCriterionVerdict',
        'selectionLayer',
        'tiebreakUsed',
        'total',
        'winnerForkIndex',
      ].sort(),
    )
  })

  it('output key set includes judgeQualityWarnings for partial success', () => {
    const meta = buildCommodityReliabilityMetadata({
      successCount: 1,
      total: 2,
      forkOutcomes: twoForks,
    })
    expect(Object.keys(meta).sort()).toEqual(
      [
        'discardedForks',
        'eligible',
        'judgeQualityWarnings',
        'mode',
        'noSignal',
        'perCriterionVerdict',
        'selectionLayer',
        'tiebreakUsed',
        'total',
        'winnerForkIndex',
      ].sort(),
    )
  })

  it('output key set includes failureCause when all forks failed', () => {
    const meta = buildCommodityReliabilityMetadata({
      successCount: 0,
      total: 2,
      forkOutcomes: allFailedForks,
    })
    expect(Object.keys(meta).sort()).toEqual(
      [
        'discardedForks',
        'eligible',
        'failureCause',
        'mode',
        'noSignal',
        'perCriterionVerdict',
        'selectionLayer',
        'tiebreakUsed',
        'total',
        'winnerForkIndex',
      ].sort(),
    )
  })

  describe('judge fields are absent — commodity mode does not run a judge', () => {
    it('does not include fallbackUsed (commodity mode never emits it)', () => {
      const meta = buildCommodityReliabilityMetadata({
        successCount: 2,
        total: 2,
        forkOutcomes: allSucceededForks,
      })
      expect(JSON.parse(JSON.stringify(meta))).not.toHaveProperty('fallbackUsed')
    })

    it('does not include judgeInput (no judge runs in commodity mode)', () => {
      const meta = buildCommodityReliabilityMetadata({
        successCount: 2,
        total: 2,
        forkOutcomes: allSucceededForks,
      })
      expect(JSON.parse(JSON.stringify(meta))).not.toHaveProperty('judgeInput')
    })
  })

  describe('judgeQualityWarnings — partial success signal', () => {
    it.each([
      [1, 2],
      [1, 3],
      [2, 3],
    ])('emits exactly one commodityPartialSuccess warning when %i of %i forks succeed', (successCount, total) => {
      const forks = Array.from({length: total}, (_, i) => ({
        forkIndex: i,
        succeeded: i < successCount,
      }))
      const meta = buildCommodityReliabilityMetadata({
        successCount,
        total,
        forkOutcomes: forks,
      })
      expect(meta.judgeQualityWarnings).toEqual([COMMODITY_PARTIAL_SUCCESS_WARNING])
    })

    it.each([
      [2, 2],
      [0, 2],
      [0, 0],
      [1, 1],
    ])('does not emit judgeQualityWarnings when successCount %i of total %i (non-partial)', (successCount, total) => {
      const forks = Array.from({length: total}, (_, i) => ({
        forkIndex: i,
        succeeded: i < successCount,
      }))
      const meta = buildCommodityReliabilityMetadata({
        successCount,
        total,
        forkOutcomes: forks,
      })
      expect(meta).not.toHaveProperty('judgeQualityWarnings')
    })

    it('partial success does not emit failureCause', () => {
      const meta = buildCommodityReliabilityMetadata({
        successCount: 1,
        total: 2,
        forkOutcomes: twoForks,
      })
      expect(JSON.parse(JSON.stringify(meta))).not.toHaveProperty('failureCause')
    })
  })

  describe('single-fork degenerate case (total: 1)', () => {
    it('single fork succeeded — eligible: 1, discardedForks: []', () => {
      const meta = buildCommodityReliabilityMetadata({
        successCount: 1,
        total: 1,
        forkOutcomes: [{forkIndex: 0, succeeded: true}],
      })
      expect(meta.eligible).toBe(1)
      expect(meta.total).toBe(1)
      expect(meta.discardedForks).toEqual([])
    })

    it('single fork failed — eligible: 0, discardedForks contains it', () => {
      const meta = buildCommodityReliabilityMetadata({
        successCount: 0,
        total: 1,
        forkOutcomes: [{forkIndex: 0, succeeded: false}],
      })
      expect(meta.eligible).toBe(0)
      expect(meta.total).toBe(1)
      expect(meta.discardedForks).toHaveLength(1)
      expect(meta.discardedForks[0].forkIndex).toBe(0)
      expect(meta.discardedForks[0].status).toBe('runtime-failed')
    })
  })

  it('empty forkOutcomes (total: 0) produces empty discardedForks and eligible: 0', () => {
    const meta = buildCommodityReliabilityMetadata({
      successCount: 0,
      total: 0,
      forkOutcomes: [],
    })
    expect(meta.eligible).toBe(0)
    expect(meta.total).toBe(0)
    expect(meta.discardedForks).toEqual([])
    expect(meta.winnerForkIndex).toBeNull()
    expect(meta.mode).toBe('commodity')
  })

  it('non-sequential forkIndex values in forkOutcomes are preserved in discardedForks', () => {
    const sparseForks = [
      {forkIndex: 2, succeeded: false},
      {forkIndex: 5, succeeded: true},
      {forkIndex: 9, succeeded: false},
    ]
    const meta = buildCommodityReliabilityMetadata({
      successCount: 1,
      total: 3,
      forkOutcomes: sparseForks,
    })
    expect(meta.discardedForks.map(d => d.forkIndex)).toEqual([2, 9])
    expect(meta.discardedForks.every(d => d.status === 'runtime-failed')).toBe(true)
  })
})

describe('buildReliabilityMetadata — generatorOnlyJudge field', () => {
  const base = {
    winnerForkIndex: 0,
    mode: 'strict',
    selectionLayer: 'primary',
  }

  it('is absent from JSON when verdict does not set it', () => {
    const meta = buildReliabilityMetadata(base, [], 0, 1)
    expect(JSON.parse(JSON.stringify(meta))).not.toHaveProperty('generatorOnlyJudge')
  })

  it('is absent from JSON when verdict sets it to false', () => {
    const meta = buildReliabilityMetadata({...base, generatorOnlyJudge: false}, [], 0, 1)
    expect(JSON.parse(JSON.stringify(meta))).not.toHaveProperty('generatorOnlyJudge')
  })

  it('is emitted as exactly boolean true when verdict sets it to true', () => {
    const meta = buildReliabilityMetadata({...base, generatorOnlyJudge: true}, [], 0, 1)
    expect(meta.generatorOnlyJudge).toBe(true)
  })

  it('normalizes any truthy verdict value to exactly boolean true in output', () => {
    const meta = buildReliabilityMetadata({...base, generatorOnlyJudge: 1}, [], 0, 1)
    expect(meta.generatorOnlyJudge).toBe(true)
  })

  it('is independent of selectionLayer — emitted regardless of which pool the winner came from', () => {
    for (const selectionLayer of ['primary', 'fallback', 'none']) {
      const meta = buildReliabilityMetadata({...base, selectionLayer, generatorOnlyJudge: true}, [], 0, 1)
      expect(meta.generatorOnlyJudge).toBe(true)
    }
  })
})

describe('buildReliabilityMetadata — judgeReasoningRequested field', () => {
  const base = {
    winnerForkIndex: 0,
    mode: 'strict',
    selectionLayer: 'primary',
  }

  it('is absent from JSON when verdict does not set it', () => {
    const meta = buildReliabilityMetadata(base, [], 0, 1)
    expect(JSON.parse(JSON.stringify(meta))).not.toHaveProperty('judgeReasoningRequested')
  })

  it('is absent from JSON when verdict sets it to false', () => {
    const meta = buildReliabilityMetadata({...base, judgeReasoningRequested: false}, [], 0, 1)
    expect(JSON.parse(JSON.stringify(meta))).not.toHaveProperty('judgeReasoningRequested')
  })

  it('is emitted as exactly boolean true when verdict sets it to true', () => {
    const meta = buildReliabilityMetadata({...base, judgeReasoningRequested: true}, [], 0, 1)
    expect(meta.judgeReasoningRequested).toBe(true)
  })

  it('normalizes any truthy verdict value to exactly boolean true in output', () => {
    const meta = buildReliabilityMetadata({...base, judgeReasoningRequested: 1}, [], 0, 1)
    expect(meta.judgeReasoningRequested).toBe(true)
  })

  it('is independent of selectionLayer — emitted regardless of which pool the winner came from', () => {
    for (const selectionLayer of ['primary', 'fallback', 'none']) {
      const meta = buildReliabilityMetadata({...base, selectionLayer, judgeReasoningRequested: true}, [], 0, 1)
      expect(meta.judgeReasoningRequested).toBe(true)
    }
  })
})

describe('buildReliabilityMetadata — optional boolean flags are mutually independent', () => {
  it('all three flags (fallbackUsed, generatorOnlyJudge, judgeReasoningRequested) coexist without interference', () => {
    const meta = buildReliabilityMetadata(
      {
        winnerForkIndex: 0,
        mode: 'fallback',
        selectionLayer: 'fallback',
        generatorOnlyJudge: true,
        judgeReasoningRequested: true,
      },
      [],
      0,
      1,
    )
    expect(meta.fallbackUsed).toBe(true)
    expect(meta.generatorOnlyJudge).toBe(true)
    expect(meta.judgeReasoningRequested).toBe(true)
  })

  it('generatorOnlyJudge true and judgeReasoningRequested false are independent', () => {
    const meta = buildReliabilityMetadata(
      {
        winnerForkIndex: 0,
        mode: 'strict',
        selectionLayer: 'primary',
        generatorOnlyJudge: true,
      },
      [],
      0,
      1,
    )
    expect(meta.generatorOnlyJudge).toBe(true)
    expect(JSON.parse(JSON.stringify(meta))).not.toHaveProperty('judgeReasoningRequested')
  })

  it('judgeReasoningRequested true and generatorOnlyJudge false are independent', () => {
    const meta = buildReliabilityMetadata(
      {
        winnerForkIndex: 0,
        mode: 'strict',
        selectionLayer: 'primary',
        judgeReasoningRequested: true,
      },
      [],
      0,
      1,
    )
    expect(meta.judgeReasoningRequested).toBe(true)
    expect(JSON.parse(JSON.stringify(meta))).not.toHaveProperty('generatorOnlyJudge')
  })
})

describe('buildCommodityReliabilityMetadata — all-failed failureCause', () => {
  it('emits failureCause: runtime-failed when successCount is 0 and total > 0', () => {
    const allFailed = [
      {forkIndex: 0, succeeded: false},
      {forkIndex: 1, succeeded: false},
    ]
    const meta = buildCommodityReliabilityMetadata({
      successCount: 0,
      total: 2,
      forkOutcomes: allFailed,
    })
    expect(meta.failureCause).toBe('runtime-failed')
  })

  it('omits failureCause when at least one fork succeeded', () => {
    const partial = [
      {forkIndex: 0, succeeded: true},
      {forkIndex: 1, succeeded: false},
    ]
    const meta = buildCommodityReliabilityMetadata({
      successCount: 1,
      total: 2,
      forkOutcomes: partial,
    })
    expect(JSON.parse(JSON.stringify(meta))).not.toHaveProperty('failureCause')
  })

  it('omits failureCause for all-succeeded case', () => {
    const allOk = [
      {forkIndex: 0, succeeded: true},
      {forkIndex: 1, succeeded: true},
    ]
    const meta = buildCommodityReliabilityMetadata({
      successCount: 2,
      total: 2,
      forkOutcomes: allOk,
    })
    expect(JSON.parse(JSON.stringify(meta))).not.toHaveProperty('failureCause')
  })

  it('omits failureCause when total is 0 (degenerate empty run)', () => {
    const meta = buildCommodityReliabilityMetadata({
      successCount: 0,
      total: 0,
      forkOutcomes: [],
    })
    expect(JSON.parse(JSON.stringify(meta))).not.toHaveProperty('failureCause')
  })
})

describe('buildInvalidReliabilityMetadata', () => {
  it.each(['missing-parent', 'invalid-criteria'])('mode is always "invalid" regardless of cause (%s)', cause => {
    expect(buildInvalidReliabilityMetadata({failureCause: cause}).mode).toBe('invalid')
  })

  it.each(['missing-parent', 'invalid-criteria'])(
    'winnerForkIndex is null and the key is present in output (cause: %s)',
    cause => {
      const meta = buildInvalidReliabilityMetadata({failureCause: cause})
      expect(meta.winnerForkIndex).toBeNull()
      expect('winnerForkIndex' in meta).toBe(true)
    },
  )

  it.each(['missing-parent', 'invalid-criteria'])('eligible and total are 0 — no forks ran (cause: %s)', cause => {
    const meta = buildInvalidReliabilityMetadata({failureCause: cause})
    expect(meta.eligible).toBe(0)
    expect(meta.total).toBe(0)
  })

  it.each(['missing-parent', 'invalid-criteria'])('failureCause %s passes through unchanged', cause => {
    expect(buildInvalidReliabilityMetadata({failureCause: cause}).failureCause).toBe(cause)
  })

  it.each(['missing-parent', 'invalid-criteria'])(
    'failureCause survives JSON serialization round-trip (cause: %s)',
    cause => {
      const meta = buildInvalidReliabilityMetadata({failureCause: cause})
      expect(JSON.parse(JSON.stringify(meta)).failureCause).toBe(cause)
    },
  )

  it.each(['missing-parent', 'invalid-criteria'])(
    'noSignal and tiebreakUsed are both false — no selection signal exists (cause: %s)',
    cause => {
      const meta = buildInvalidReliabilityMetadata({failureCause: cause})
      expect(meta.noSignal).toBe(false)
      expect(meta.tiebreakUsed).toBe(false)
    },
  )

  it.each(['missing-parent', 'invalid-criteria'])(
    'perCriterionVerdict is empty array — no criteria were evaluated (cause: %s)',
    cause => {
      expect(buildInvalidReliabilityMetadata({failureCause: cause}).perCriterionVerdict).toEqual([])
    },
  )

  it.each(['missing-parent', 'invalid-criteria'])('discardedForks is empty array — no forks ran (cause: %s)', cause => {
    expect(buildInvalidReliabilityMetadata({failureCause: cause}).discardedForks).toEqual([])
  })

  it.each(['missing-parent', 'invalid-criteria'])(
    'selectionLayer is "primary" — no fork-pool selection occurred (cause: %s)',
    cause => {
      expect(buildInvalidReliabilityMetadata({failureCause: cause}).selectionLayer).toBe('primary')
    },
  )

  it('includes remediationHint when provided', () => {
    const meta = buildInvalidReliabilityMetadata({
      failureCause: 'invalid-criteria',
      remediationHint: 'adjust-criteria',
    })
    expect(meta.remediationHint).toBe('adjust-criteria')
  })

  it('omits remediationHint from JSON when not provided', () => {
    const meta = buildInvalidReliabilityMetadata({
      failureCause: 'missing-parent',
    })
    expect(JSON.parse(JSON.stringify(meta))).not.toHaveProperty('remediationHint')
  })

  it.each(['missing-parent', 'invalid-criteria'])(
    'key set without remediationHint matches invalid contract shape (cause: %s)',
    cause => {
      const meta = buildInvalidReliabilityMetadata({failureCause: cause})
      expect(Object.keys(meta).sort()).toEqual(
        [
          'discardedForks',
          'eligible',
          'failureCause',
          'mode',
          'noSignal',
          'perCriterionVerdict',
          'selectionLayer',
          'tiebreakUsed',
          'total',
          'winnerForkIndex',
        ].sort(),
      )
    },
  )

  it('key set with remediationHint includes the extra field in JSON output', () => {
    const meta = buildInvalidReliabilityMetadata({
      failureCause: 'invalid-criteria',
      remediationHint: 'adjust-criteria',
    })
    expect(Object.keys(JSON.parse(JSON.stringify(meta))).sort()).toContain('remediationHint')
  })
})

describe('buildValidateRetryWithheldReliabilityMetadata', () => {
  it('records a visible non-retry verdict for side-effecting parents', () => {
    const meta = buildValidateRetryWithheldReliabilityMetadata({
      cause: 'side-effecting-alias',
      requestedRetry: 2,
      passedCount: 0,
      total: 1,
    })

    expect(meta).toEqual(
      expect.objectContaining({
        winnerForkIndex: null,
        mode: 'invalid',
        selectionLayer: 'primary',
        retryWithheld: true,
        cause: 'side-effecting-alias',
        requestedRetry: 2,
        eligible: 0,
        total: 1,
        failureCause: 'criteria-failed',
      }),
    )
  })

  it('mode is always "invalid" — withheld retry is an incomplete execution state', () => {
    expect(
      buildValidateRetryWithheldReliabilityMetadata({
        cause: 'side-effecting-alias',
        requestedRetry: 1,
        passedCount: 0,
        total: 1,
      }).mode,
    ).toBe('invalid')
  })

  it('retryWithheld is always true — the distinguishing flag for downstream consumers', () => {
    expect(
      buildValidateRetryWithheldReliabilityMetadata({
        cause: 'any',
        requestedRetry: 0,
        passedCount: 0,
        total: 1,
      }).retryWithheld,
    ).toBe(true)
  })

  it('eligible equals passedCount when some validates passed before retry was withheld', () => {
    const meta = buildValidateRetryWithheldReliabilityMetadata({
      cause: 'any',
      requestedRetry: 2,
      passedCount: 2,
      total: 3,
    })
    expect(meta.eligible).toBe(2)
  })

  it('total passes through unchanged', () => {
    expect(
      buildValidateRetryWithheldReliabilityMetadata({
        cause: 'any',
        requestedRetry: 1,
        passedCount: 0,
        total: 5,
      }).total,
    ).toBe(5)
  })

  it('cause passes through unchanged', () => {
    expect(
      buildValidateRetryWithheldReliabilityMetadata({
        cause: 'rpc-alias',
        requestedRetry: 1,
        passedCount: 0,
        total: 1,
      }).cause,
    ).toBe('rpc-alias')
  })

  it('requestedRetry passes through unchanged', () => {
    expect(
      buildValidateRetryWithheldReliabilityMetadata({
        cause: 'any',
        requestedRetry: 5,
        passedCount: 0,
        total: 1,
      }).requestedRetry,
    ).toBe(5)
  })

  it('discardedForks is always empty — no fork candidates exist for a validate withheld verdict', () => {
    expect(
      buildValidateRetryWithheldReliabilityMetadata({
        cause: 'any',
        requestedRetry: 2,
        passedCount: 0,
        total: 1,
      }).discardedForks,
    ).toEqual([])
  })

  it('noSignal is false and tiebreakUsed is false — no judge selection occurred', () => {
    const meta = buildValidateRetryWithheldReliabilityMetadata({
      cause: 'any',
      requestedRetry: 1,
      passedCount: 0,
      total: 1,
    })
    expect(meta.noSignal).toBe(false)
    expect(meta.tiebreakUsed).toBe(false)
  })

  it('key set matches the withheld-retry contract shape', () => {
    const meta = buildValidateRetryWithheldReliabilityMetadata({
      cause: 'side-effecting-alias',
      requestedRetry: 2,
      passedCount: 0,
      total: 1,
    })
    expect(Object.keys(meta).sort()).toEqual(
      [
        'cause',
        'discardedForks',
        'eligible',
        'failureCause',
        'mode',
        'noSignal',
        'perCriterionVerdict',
        'remediationHint',
        'requestedRetry',
        'retryWithheld',
        'selectionLayer',
        'tiebreakUsed',
        'total',
        'winnerForkIndex',
      ].sort(),
    )
  })
})

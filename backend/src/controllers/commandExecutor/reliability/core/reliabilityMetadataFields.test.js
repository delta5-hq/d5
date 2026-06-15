import {DEGRADED_INPUT_THRESHOLD_CHARS} from './judgeContentBudget'
import {
  buildReliabilityMetadata,
  buildDiscardedFork,
  buildJudgeInputMetadata,
  buildJudgeQualityWarning,
  buildForkRankingEntry,
  buildPerCriterionVerdictEntry,
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
  })

  describe('optional fields pass through from verdict when provided', () => {
    const criteria = [{criterionId: 'v1', criterion: 'must include numbers', forkRankings: []}]
    const judgeInput = {
      candidateCount: 2,
      perForkBudgetChars: 5000,
      degradedInput: false,
      resolvedJudgeFamilies: ['openai'],
    }
    const warnings = [{condition: 'singleProvider', severity: 'high'}]

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
      const loser = {forkIndex: 1, status: 'criteria-failed', failedAt: 'must include numbers', attempts: 3}
      const meta = buildReliabilityMetadata(minimalVerdict, [{forkIndex: 0, status: 'ok'}, loser], 1, 2)
      expect(meta.discardedForks[0]).toEqual({
        forkIndex: 1,
        status: 'criteria-failed',
        failedAt: 'must include numbers',
        attempts: 3,
      })
    })

    it('runtime-failed fork carries reason and omits failedAt and attempts', () => {
      const loser = {forkIndex: 1, status: 'runtime-failed', reason: 'context deadline exceeded'}
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
      expect(buildDiscardedFork({forkIndex: 1, status: 'criteria-failed', failedAt: 'criterion'})).toHaveProperty(
        'failedAt',
        'criterion',
      )
    })

    it('failedAt is absent when undefined', () => {
      expect(buildDiscardedFork({forkIndex: 1, status: 'ok'})).not.toHaveProperty('failedAt')
    })

    it('reason appears when defined', () => {
      expect(buildDiscardedFork({forkIndex: 1, status: 'runtime-failed', reason: 'timeout'})).toHaveProperty(
        'reason',
        'timeout',
      )
    })

    it('reason is absent when undefined', () => {
      expect(buildDiscardedFork({forkIndex: 1, status: 'ok'})).not.toHaveProperty('reason')
    })

    it('attempts appears when defined', () => {
      expect(buildDiscardedFork({forkIndex: 1, status: 'criteria-failed', attempts: 3})).toHaveProperty('attempts', 3)
    })

    it('attempts is absent when undefined', () => {
      expect(buildDiscardedFork({forkIndex: 1, status: 'ok'})).not.toHaveProperty('attempts')
    })
  })

  describe('zero and empty-string optional values are defined (not equivalent to undefined)', () => {
    it('attempts: 0 appears in output', () => {
      expect(buildDiscardedFork({forkIndex: 1, status: 'criteria-failed', attempts: 0})).toHaveProperty('attempts', 0)
    })

    it('failedAt: "" appears in output', () => {
      expect(buildDiscardedFork({forkIndex: 1, status: 'criteria-failed', failedAt: ''})).toHaveProperty('failedAt', '')
    })

    it('reason: "" appears in output', () => {
      expect(buildDiscardedFork({forkIndex: 1, status: 'runtime-failed', reason: ''})).toHaveProperty('reason', '')
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
      const result = buildDiscardedFork({forkIndex: 1, status: 'criteria-failed', ...optionals})
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
      const result = buildJudgeInputMetadata({candidateCount: count, perForkBudget: 5000, resolvedModels: []})
      expect(result.candidateCount).toBe(count)
    })

    it('perForkBudget is exposed as perForkBudgetChars', () => {
      const result = buildJudgeInputMetadata({candidateCount: 1, perForkBudget: 12345, resolvedModels: []})
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
      const result = buildJudgeInputMetadata({candidateCount: 2, perForkBudget: 5000, resolvedModels: models})
      expect(result.resolvedJudgeFamilies.sort()).toEqual(['claude', 'openai'])
    })

    it('preserves first-seen order after deduplication', () => {
      const models = [{judgeFamily: 'claude'}, {judgeFamily: 'openai'}, {judgeFamily: 'claude'}]
      const result = buildJudgeInputMetadata({candidateCount: 2, perForkBudget: 5000, resolvedModels: models})
      expect(result.resolvedJudgeFamilies).toEqual(['claude', 'openai'])
    })

    it('filters out null and undefined judgeFamily values', () => {
      const models = [{judgeFamily: 'openai'}, {judgeFamily: null}, {judgeFamily: undefined}]
      const result = buildJudgeInputMetadata({candidateCount: 2, perForkBudget: 5000, resolvedModels: models})
      expect(result.resolvedJudgeFamilies).toEqual(['openai'])
    })

    it('filters out empty-string judgeFamily (falsy)', () => {
      const models = [{judgeFamily: 'openai'}, {judgeFamily: ''}]
      const result = buildJudgeInputMetadata({candidateCount: 2, perForkBudget: 5000, resolvedModels: models})
      expect(result.resolvedJudgeFamilies).toEqual(['openai'])
    })

    it('returns empty array when resolvedModels is empty', () => {
      const result = buildJudgeInputMetadata({candidateCount: 0, perForkBudget: 5000, resolvedModels: []})
      expect(result.resolvedJudgeFamilies).toEqual([])
    })

    it('returns empty array when all models have falsy family values', () => {
      const models = [{judgeFamily: null}, {judgeFamily: undefined}, {judgeFamily: ''}]
      const result = buildJudgeInputMetadata({candidateCount: 3, perForkBudget: 5000, resolvedModels: models})
      expect(result.resolvedJudgeFamilies).toEqual([])
    })
  })

  describe('output key set is exactly the four declared fields', () => {
    it('contains exactly candidateCount, perForkBudgetChars, degradedInput, resolvedJudgeFamilies', () => {
      const result = buildJudgeInputMetadata({candidateCount: 1, perForkBudget: 5000, resolvedModels: []})
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
    const result = buildJudgeQualityWarning({condition: 'singleProvider', severity: 'high'})
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
    expect(buildForkRankingEntry({forkIndex: 2, rank: 1})).toEqual({forkIndex: 2, rank: 1})
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
    const result = buildPerCriterionVerdictEntry({criterionId: '', criterion: 'x', forkRankings: []})
    expect(result.criterionId).toBe('')
  })

  it('empty forkRankings array is preserved', () => {
    const result = buildPerCriterionVerdictEntry({criterionId: 'v1', criterion: 'x', forkRankings: []})
    expect(result.forkRankings).toEqual([])
  })

  it('output key set is exactly {criterionId, criterion, forkRankings}', () => {
    const result = buildPerCriterionVerdictEntry({criterionId: 'v1', criterion: 'x', forkRankings: []})
    expect(Object.keys(result).sort()).toEqual(['criterion', 'criterionId', 'forkRankings'])
  })
})

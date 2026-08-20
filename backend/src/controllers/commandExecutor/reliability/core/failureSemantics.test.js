import {
  classifyNoWinner,
  deterministicFailureReason,
  FAILURE_CAUSE,
  REMEDIATION_HINT,
  JUDGE_WARNING_CONDITION,
  STRUCTURAL_GATE_REJECTION_REASON,
} from './failureSemantics'

describe('classifyNoWinner', () => {
  it.each([
    [
      'structural-gate precedence',
      {
        allGateFiltered: true,
        forkResults: [
          {forkIndex: 0, status: 'ok'},
          {forkIndex: 1, status: 'criteria-failed'},
        ],
      },
      {
        failureCause: FAILURE_CAUSE.STRUCTURAL_GATE,
        remediationHint: REMEDIATION_HINT.REVISE_PROMPT,
      },
    ],
    [
      'allGateFiltered wins over noSignal when both flags are true',
      {
        allGateFiltered: true,
        noSignal: true,
        forkResults: [],
      },
      {
        failureCause: FAILURE_CAUSE.STRUCTURAL_GATE,
        remediationHint: REMEDIATION_HINT.REVISE_PROMPT,
      },
    ],
    [
      'no-signal precedence over fork-status summary',
      {
        noSignal: true,
        forkResults: [{forkIndex: 0, status: 'runtime-failed'}],
      },
      {
        failureCause: FAILURE_CAUSE.NO_JUDGE_SIGNAL,
        remediationHint: REMEDIATION_HINT.NONE,
      },
    ],
    [
      'all runtime-failed',
      {
        forkResults: [
          {forkIndex: 0, status: 'runtime-failed'},
          {forkIndex: 1, status: 'runtime-failed'},
        ],
      },
      {
        failureCause: FAILURE_CAUSE.RUNTIME_FAILED,
        remediationHint: REMEDIATION_HINT.CHECK_PROVIDER,
      },
    ],
    [
      'all criteria-failed',
      {
        forkResults: [
          {forkIndex: 0, status: 'criteria-failed'},
          {forkIndex: 1, status: 'criteria-failed'},
        ],
      },
      {
        failureCause: FAILURE_CAUSE.CRITERIA_FAILED,
        remediationHint: REMEDIATION_HINT.ADJUST_CRITERIA,
      },
    ],
    [
      'mixed ineligible forks',
      {
        forkResults: [
          {forkIndex: 0, status: 'runtime-failed'},
          {forkIndex: 1, status: 'criteria-failed'},
        ],
      },
      {
        failureCause: FAILURE_CAUSE.NO_ELIGIBLE_FORKS,
        remediationHint: REMEDIATION_HINT.NONE,
      },
    ],
    [
      'empty fork set',
      {forkResults: []},
      {
        failureCause: FAILURE_CAUSE.NO_ELIGIBLE_FORKS,
        remediationHint: REMEDIATION_HINT.NONE,
      },
    ],
  ])('%s', (_, input, expected) => {
    expect(classifyNoWinner(input)).toEqual(expected)
  })

  it.each([
    {allGateFiltered: true, forkResults: []},
    {noSignal: true, forkResults: []},
    {forkResults: [{forkIndex: 0, status: 'runtime-failed'}]},
    {forkResults: [{forkIndex: 0, status: 'criteria-failed'}]},
    {forkResults: []},
  ])('never returns command-configuration failure causes (missing-parent, invalid-criteria)', input => {
    const {failureCause} = classifyNoWinner(input)
    expect(failureCause).not.toBe(FAILURE_CAUSE.MISSING_PARENT)
    expect(failureCause).not.toBe(FAILURE_CAUSE.INVALID_CRITERIA)
  })
})

describe('FAILURE_CAUSE constants', () => {
  it.each([
    ['STRUCTURAL_GATE', 'structural-gate'],
    ['CRITERIA_FAILED', 'criteria-failed'],
    ['RUNTIME_FAILED', 'runtime-failed'],
    ['NO_ELIGIBLE_FORKS', 'no-eligible-forks'],
    ['NO_JUDGE_SIGNAL', 'no-judge-signal'],
    ['MISSING_PARENT', 'missing-parent'],
    ['INVALID_CRITERIA', 'invalid-criteria'],
  ])('FAILURE_CAUSE.%s === %s', (key, value) => {
    expect(FAILURE_CAUSE[key]).toBe(value)
  })

  it('is frozen — no new keys can be added at runtime', () => {
    expect(() => {
      FAILURE_CAUSE.NEW_KEY = 'new'
    }).toThrow()
  })

  it('all values are unique — no two keys map to the same string', () => {
    const values = Object.values(FAILURE_CAUSE)
    expect(values.length).toBe(new Set(values).size)
  })

  it('contains exactly the 7 canonical cause strings', () => {
    expect(new Set(Object.values(FAILURE_CAUSE))).toEqual(
      new Set([
        'structural-gate',
        'criteria-failed',
        'runtime-failed',
        'no-eligible-forks',
        'no-judge-signal',
        'missing-parent',
        'invalid-criteria',
      ]),
    )
  })
})

describe('REMEDIATION_HINT constants', () => {
  it.each([
    ['REVISE_PROMPT', 'revise-prompt'],
    ['CHECK_PROVIDER', 'check-provider'],
    ['ADJUST_CRITERIA', 'adjust-criteria'],
    ['NONE', 'none'],
  ])('REMEDIATION_HINT.%s === %s', (key, value) => {
    expect(REMEDIATION_HINT[key]).toBe(value)
  })

  it('is frozen — no new keys can be added at runtime', () => {
    expect(() => {
      REMEDIATION_HINT.NEW_KEY = 'new'
    }).toThrow()
  })

  it('all values are unique — no two keys map to the same string', () => {
    const values = Object.values(REMEDIATION_HINT)
    expect(values.length).toBe(new Set(values).size)
  })

  it('contains exactly the 4 canonical hint strings', () => {
    expect(new Set(Object.values(REMEDIATION_HINT))).toEqual(
      new Set(['revise-prompt', 'check-provider', 'adjust-criteria', 'none']),
    )
  })
})

describe('JUDGE_WARNING_CONDITION constants', () => {
  it.each([
    ['ALL_GATE_FILTERED', 'allGateFiltered'],
    ['SINGLE_PROVIDER', 'singleProvider'],
    ['LOWEST_TIER_ONLY', 'lowestTierOnly'],
    ['NO_REASONING_MODE', 'noReasoningMode'],
    ['DEGRADED_INPUT', 'degradedInput'],
    ['JURY_DUPLICATES', 'juryDuplicates'],
    ['FALLBACK_WITH_WEAK_JUDGE', 'fallbackWithWeakJudge'],
    ['COMMODITY_PARTIAL_SUCCESS', 'commodityPartialSuccess'],
  ])('JUDGE_WARNING_CONDITION.%s === %s', (key, value) => {
    expect(JUDGE_WARNING_CONDITION[key]).toBe(value)
  })

  it('is frozen — no new keys can be added at runtime', () => {
    expect(() => {
      JUDGE_WARNING_CONDITION.NEW_KEY = 'new'
    }).toThrow()
  })

  it('all values are unique — no two keys map to the same condition string', () => {
    const values = Object.values(JUDGE_WARNING_CONDITION)
    expect(values.length).toBe(new Set(values).size)
  })

  it('contains exactly the 8 canonical condition strings', () => {
    expect(new Set(Object.values(JUDGE_WARNING_CONDITION))).toEqual(
      new Set([
        'allGateFiltered',
        'singleProvider',
        'lowestTierOnly',
        'noReasoningMode',
        'degradedInput',
        'juryDuplicates',
        'fallbackWithWeakJudge',
        'commodityPartialSuccess',
      ]),
    )
  })
})

describe('deterministicFailureReason', () => {
  it('classifies execution error node', () => {
    expect(deterministicFailureReason({executionStatus: 'error'})).toBe(
      STRUCTURAL_GATE_REJECTION_REASON.EXECUTION_ERROR,
    )
  })

  it('executionStatus:error combined with isError:true still returns EXECUTION_ERROR — executionStatus branch fires first', () => {
    expect(deterministicFailureReason({executionStatus: 'error', isError: true})).toBe(
      STRUCTURAL_GATE_REJECTION_REASON.EXECUTION_ERROR,
    )
  })

  it.each([
    ['missing signal', undefined],
    ['explicit null signal', null],
    ['successful MCP result', {isError: false}],
    ['HTTP lower success boundary', {httpStatus: 200}],
    ['HTTP upper success boundary', {httpStatus: 299}],
    ['SSH zero exit', {exitCode: 0}],
    ['ok fork status', {status: 'ok'}],
  ])('returns null for %s', (_, signal) => {
    expect(deterministicFailureReason(signal)).toBeNull()
  })
})

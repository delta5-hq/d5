import {classifyNoWinner, FAILURE_CAUSE, REMEDIATION_HINT} from './failureSemantics'

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
})

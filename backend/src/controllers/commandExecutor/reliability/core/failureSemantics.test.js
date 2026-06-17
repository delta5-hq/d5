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
      {failureCause: FAILURE_CAUSE.STRUCTURAL_GATE, remediationHint: REMEDIATION_HINT.REVISE_PROMPT},
    ],
    [
      'no-signal precedence over fork-status summary',
      {noSignal: true, forkResults: [{forkIndex: 0, status: 'runtime-failed'}]},
      {failureCause: FAILURE_CAUSE.NO_JUDGE_SIGNAL, remediationHint: REMEDIATION_HINT.NONE},
    ],
    [
      'all runtime-failed',
      {
        forkResults: [
          {forkIndex: 0, status: 'runtime-failed'},
          {forkIndex: 1, status: 'runtime-failed'},
        ],
      },
      {failureCause: FAILURE_CAUSE.RUNTIME_FAILED, remediationHint: REMEDIATION_HINT.CHECK_PROVIDER},
    ],
    [
      'all criteria-failed',
      {
        forkResults: [
          {forkIndex: 0, status: 'criteria-failed'},
          {forkIndex: 1, status: 'criteria-failed'},
        ],
      },
      {failureCause: FAILURE_CAUSE.CRITERIA_FAILED, remediationHint: REMEDIATION_HINT.ADJUST_CRITERIA},
    ],
    [
      'mixed ineligible forks',
      {
        forkResults: [
          {forkIndex: 0, status: 'runtime-failed'},
          {forkIndex: 1, status: 'criteria-failed'},
        ],
      },
      {failureCause: FAILURE_CAUSE.NO_ELIGIBLE_FORKS, remediationHint: REMEDIATION_HINT.NONE},
    ],
    [
      'empty fork set',
      {forkResults: []},
      {failureCause: FAILURE_CAUSE.NO_ELIGIBLE_FORKS, remediationHint: REMEDIATION_HINT.NONE},
    ],
  ])('%s', (_, input, expected) => {
    expect(classifyNoWinner(input)).toEqual(expected)
  })
})

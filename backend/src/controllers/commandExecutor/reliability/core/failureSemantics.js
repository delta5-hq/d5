export const FAILURE_CAUSE = Object.freeze({
  STRUCTURAL_GATE: 'structural-gate',
  CRITERIA_FAILED: 'criteria-failed',
  RUNTIME_FAILED: 'runtime-failed',
  NO_ELIGIBLE_FORKS: 'no-eligible-forks',
  NO_JUDGE_SIGNAL: 'no-judge-signal',
  MISSING_PARENT: 'missing-parent',
  INVALID_CRITERIA: 'invalid-criteria',
})

export const REMEDIATION_HINT = Object.freeze({
  REVISE_PROMPT: 'revise-prompt',
  CHECK_PROVIDER: 'check-provider',
  ADJUST_CRITERIA: 'adjust-criteria',
  NONE: 'none',
})

export function classifyNoWinner({allGateFiltered = false, noSignal = false, forkResults = []}) {
  if (allGateFiltered) {
    return {
      failureCause: FAILURE_CAUSE.STRUCTURAL_GATE,
      remediationHint: REMEDIATION_HINT.REVISE_PROMPT,
    }
  }

  if (noSignal) {
    return {
      failureCause: FAILURE_CAUSE.NO_JUDGE_SIGNAL,
      remediationHint: REMEDIATION_HINT.NONE,
    }
  }

  if (forkResults.length > 0 && forkResults.every(f => f.status === 'runtime-failed')) {
    return {
      failureCause: FAILURE_CAUSE.RUNTIME_FAILED,
      remediationHint: REMEDIATION_HINT.CHECK_PROVIDER,
    }
  }

  if (forkResults.length > 0 && forkResults.every(f => f.status === 'criteria-failed')) {
    return {
      failureCause: FAILURE_CAUSE.CRITERIA_FAILED,
      remediationHint: REMEDIATION_HINT.ADJUST_CRITERIA,
    }
  }

  return {
    failureCause: FAILURE_CAUSE.NO_ELIGIBLE_FORKS,
    remediationHint: REMEDIATION_HINT.NONE,
  }
}

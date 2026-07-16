export const JUDGE_WARNING_CONDITION = Object.freeze({
  ALL_GATE_FILTERED: 'allGateFiltered',
  SINGLE_PROVIDER: 'singleProvider',
  LOWEST_TIER_ONLY: 'lowestTierOnly',
  NO_REASONING_MODE: 'noReasoningMode',
  DEGRADED_INPUT: 'degradedInput',
  JURY_DUPLICATES: 'juryDuplicates',
  FALLBACK_WITH_WEAK_JUDGE: 'fallbackWithWeakJudge',
  COMMODITY_PARTIAL_SUCCESS: 'commodityPartialSuccess',
})

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

// Why a commodity :n=N fan-out was collapsed to a single execution instead of
// being run N times. Best-of-N presumes idempotent attempts; a side-effecting
// MCP/RPC alias is not idempotent, so fanning it N times duplicates real ops.
export const COMMODITY_SUPPRESSION_CAUSE = Object.freeze({
  SIDE_EFFECTING_ALIAS: 'side-effecting-alias',
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

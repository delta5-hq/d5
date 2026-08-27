import {isDegradedInput} from './judgeContentBudget'
import {FAILURE_CAUSE, JUDGE_WARNING_CONDITION, REMEDIATION_HINT} from './failureSemantics'
export {COMMODITY_SUPPRESSION_CAUSE} from './failureSemantics'

export function buildJudgeInputMetadata({candidateCount, perForkBudget, resolvedModels}) {
  return {
    candidateCount,
    perForkBudgetChars: perForkBudget,
    degradedInput: isDegradedInput(perForkBudget),
    resolvedJudgeFamilies: Array.from(new Set(resolvedModels.map(m => m.judgeFamily).filter(Boolean))),
  }
}

export function buildJudgeQualityWarning({condition, severity}) {
  return {condition, severity}
}

export function buildForkRankingEntry({forkIndex, rank}) {
  return {forkIndex, rank}
}

export function buildPerCriterionVerdictEntry({criterionId, criterion, forkRankings}) {
  return {criterionId, criterion, forkRankings}
}

export function buildDiscardedFork(f) {
  return {
    forkIndex: f.forkIndex,
    status: f.status,
    ...(f.failedAt !== undefined ? {failedAt: f.failedAt} : {}),
    ...(f.reason !== undefined ? {reason: f.reason} : {}),
    ...(f.attempts !== undefined ? {attempts: f.attempts} : {}),
  }
}

export function buildReliabilityMetadata(verdict, forkResults, okCount, n) {
  const suppressedFork = forkResults.find(f => f.suppressed)
  return {
    winnerForkIndex: verdict.winnerForkIndex,
    perCriterionVerdict: verdict.perCriterionVerdict ?? [],
    mode: verdict.mode,
    selectionLayer: verdict.selectionLayer,
    noSignal: verdict.noSignal ?? false,
    tiebreakUsed: verdict.tiebreakUsed ?? false,
    eligible: okCount,
    total: n,
    ...(suppressedFork
      ? {
          suppressed: true,
          cause: suppressedFork.cause,
          requestedN: suppressedFork.requestedN,
        }
      : {}),
    judgeInput: verdict.judgeInput,
    judgeQualityWarnings: verdict.judgeQualityWarnings ?? [],
    ...(verdict.selectionLayer === 'fallback' ? {fallbackUsed: true} : {}),
    ...(verdict.generatorOnlyJudge ? {generatorOnlyJudge: true} : {}),
    ...(verdict.judgeReasoningRequested ? {judgeReasoningRequested: true} : {}),
    ...(verdict.failureCause !== undefined ? {failureCause: verdict.failureCause} : {}),
    ...(verdict.remediationHint !== undefined ? {remediationHint: verdict.remediationHint} : {}),
    ...(verdict.allGateFiltered !== undefined ? {allGateFiltered: verdict.allGateFiltered} : {}),
    discardedForks: forkResults.filter(f => f.forkIndex !== verdict.winnerForkIndex).map(buildDiscardedFork),
  }
}

export const COMMODITY_PARTIAL_SUCCESS_WARNING = Object.freeze({
  condition: JUDGE_WARNING_CONDITION.COMMODITY_PARTIAL_SUCCESS,
  severity: 'medium',
})

export function buildCommodityReliabilityMetadata({successCount, total, forkOutcomes}) {
  const allFailed = successCount === 0 && total > 0
  const partial = successCount > 0 && successCount < total
  return {
    winnerForkIndex: null,
    perCriterionVerdict: [],
    mode: 'commodity',
    selectionLayer: 'primary',
    noSignal: false,
    tiebreakUsed: false,
    eligible: successCount,
    total,
    ...(partial ? {judgeQualityWarnings: [COMMODITY_PARTIAL_SUCCESS_WARNING]} : {}),
    ...(allFailed ? {failureCause: FAILURE_CAUSE.RUNTIME_FAILED} : {}),
    discardedForks: forkOutcomes
      .filter(f => !f.succeeded)
      .map(f =>
        buildDiscardedFork({
          forkIndex: f.forkIndex,
          status: 'runtime-failed',
        }),
      ),
  }
}

export function buildRefineReliabilityMetadata({passed, attempts, requestedN, suppressedCause}) {
  return {
    winnerForkIndex: null,
    perCriterionVerdict: [],
    mode: 'refine',
    selectionLayer: 'primary',
    noSignal: false,
    tiebreakUsed: false,
    eligible: passed ? 1 : 0,
    total: attempts,
    attempts,
    requestedN,
    ...(suppressedCause ? {suppressed: true, cause: suppressedCause} : {}),
    ...(!passed ? {failureCause: FAILURE_CAUSE.CRITERIA_FAILED} : {}),
    discardedForks: [],
  }
}

export function buildValidateReliabilityMetadata({passed}) {
  return {
    winnerForkIndex: null,
    perCriterionVerdict: [],
    mode: 'validate',
    selectionLayer: 'primary',
    noSignal: false,
    tiebreakUsed: false,
    eligible: passed ? 1 : 0,
    total: 1,
    ...(!passed ? {failureCause: FAILURE_CAUSE.CRITERIA_FAILED} : {}),
    discardedForks: [],
  }
}

// Collapsed to one execution due to a side-effecting parent — never a silent collapse, never an error node.
export function buildSuppressedReliabilityMetadata({
  cause,
  requestedN,
  eligible = 1,
  total = 1,
  failureCause,
  remediationHint,
}) {
  return {
    winnerForkIndex: null,
    perCriterionVerdict: [],
    mode: 'suppressed',
    selectionLayer: 'primary',
    noSignal: false,
    tiebreakUsed: false,
    eligible,
    total,
    suppressed: true,
    cause,
    requestedN,
    ...(failureCause !== undefined ? {failureCause} : {}),
    ...(remediationHint !== undefined ? {remediationHint} : {}),
    discardedForks: [],
  }
}

export function buildValidateRetryWithheldReliabilityMetadata({cause, requestedRetry, passedCount, total}) {
  return {
    winnerForkIndex: null,
    perCriterionVerdict: [],
    mode: 'invalid',
    selectionLayer: 'primary',
    noSignal: false,
    tiebreakUsed: false,
    eligible: passedCount,
    total,
    retryWithheld: true,
    cause,
    requestedRetry,
    failureCause: FAILURE_CAUSE.CRITERIA_FAILED,
    remediationHint: REMEDIATION_HINT.NONE,
    discardedForks: [],
  }
}

export function buildInvalidReliabilityMetadata({failureCause, remediationHint}) {
  return {
    winnerForkIndex: null,
    perCriterionVerdict: [],
    mode: 'invalid',
    selectionLayer: 'primary',
    noSignal: false,
    tiebreakUsed: false,
    eligible: 0,
    total: 0,
    failureCause,
    ...(remediationHint !== undefined ? {remediationHint} : {}),
    discardedForks: [],
  }
}

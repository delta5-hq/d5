import {isDegradedInput} from './judgeContentBudget'
import {FAILURE_CAUSE, JUDGE_WARNING_CONDITION} from './failureSemantics'

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
  return {
    winnerForkIndex: verdict.winnerForkIndex,
    perCriterionVerdict: verdict.perCriterionVerdict ?? [],
    mode: verdict.mode,
    selectionLayer: verdict.selectionLayer,
    noSignal: verdict.noSignal ?? false,
    tiebreakUsed: verdict.tiebreakUsed ?? false,
    eligible: okCount,
    total: n,
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
      .map(f => buildDiscardedFork({forkIndex: f.forkIndex, status: 'runtime-failed'})),
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

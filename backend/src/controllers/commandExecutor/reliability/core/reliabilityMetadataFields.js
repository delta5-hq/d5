import {isDegradedInput} from './judgeContentBudget'

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
    ...(verdict.failureCause !== undefined ? {failureCause: verdict.failureCause} : {}),
    ...(verdict.remediationHint !== undefined ? {remediationHint: verdict.remediationHint} : {}),
    ...(verdict.allGateFiltered !== undefined ? {allGateFiltered: verdict.allGateFiltered} : {}),
    discardedForks: forkResults.filter(f => f.forkIndex !== verdict.winnerForkIndex).map(buildDiscardedFork),
  }
}

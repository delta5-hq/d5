const SUFFIX_PATTERN =
  /\s*\[[✓✗]\s+(\d+\/\d+\s+(best\s+of\s+\d+(\s+·\s+[\d.]+)?|first-survivor[^\]]*|passed)|refined|refine\s+failed)\]\s*$/i

export const stripReliabilitySuffix = title => (title ? title.replace(SUFFIX_PATTERN, '') : '')

export const buildCandidateSuffix = (passed, total, confidence = null) => {
  const confStr = confidence !== null && !isNaN(confidence) ? ` · ${confidence.toFixed(2)}` : ''
  return `[✓ ${passed}/${total} best of ${total}${confStr}]`
}

export const buildGateFailureSuffix = total => `[✗ 0/${total} passed]`

export const buildFirstSurvivorSuffix = (passed, total) => `[✓ ${passed}/${total} first-survivor · no judge]`

export const buildJudgeAuthErrorSuffix = (passed, total) => `[✓ ${passed}/${total} first-survivor · judge auth error]`

export const buildJudgeQuotaErrorSuffix = (passed, total) =>
  `[✓ ${passed}/${total} first-survivor · judge quota exceeded]`

export const buildJudgmentSuffix = (judgment, passedCount, totalCount) => {
  switch (judgment.reason) {
    case 'judge_auth_error':
      return buildJudgeAuthErrorSuffix(passedCount, totalCount)
    case 'judge_quota_error':
      return buildJudgeQuotaErrorSuffix(passedCount, totalCount)
    case null:
      return buildCandidateSuffix(passedCount, totalCount, judgment.confidence)
    default:
      return buildFirstSurvivorSuffix(passedCount, totalCount)
  }
}

export const REFINED_SUFFIX = '[✓ refined]'

export const REFINE_FAILURE_SUFFIX = '[✗ refine failed]'

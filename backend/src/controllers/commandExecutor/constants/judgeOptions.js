const JUDGE_FAMILY_PARAM_REGEX = ':judge=([a-zA-Z0-9_]+)'
const JUDGE_REASONING_PARAM = ':judge_reasoning=true'
const JUDGE_SAMPLES_PARAM_REGEX = ':judge_samples=(\\d+)'
const JUDGE_ENSEMBLE_PARAM_REGEX = ':judge_ensemble=(\\d+)'

export const JUDGE_MAX_SAMPLES = 5
export const JUDGE_MAX_ENSEMBLE = 5
export const JUDGE_DEFAULT_SAMPLES = 1
export const JUDGE_DEFAULT_ENSEMBLE = 1

export function readJudgeFamily(str) {
  if (!str) return null
  const match = str.match(new RegExp(JUDGE_FAMILY_PARAM_REGEX))
  return match ? match[1].toLowerCase() : null
}

export function readJudgeReasoning(str) {
  if (!str) return false
  return str.includes(JUDGE_REASONING_PARAM)
}

export function readJudgeSamples(str) {
  if (!str) return JUDGE_DEFAULT_SAMPLES
  const match = str.match(new RegExp(JUDGE_SAMPLES_PARAM_REGEX))
  if (!match) return JUDGE_DEFAULT_SAMPLES
  const parsed = parseInt(match[1], 10)
  if (isNaN(parsed) || parsed < 1) return JUDGE_DEFAULT_SAMPLES
  return Math.min(parsed, JUDGE_MAX_SAMPLES)
}

export function readJudgeEnsemble(str) {
  if (!str) return JUDGE_DEFAULT_ENSEMBLE
  const match = str.match(new RegExp(JUDGE_ENSEMBLE_PARAM_REGEX))
  if (!match) return JUDGE_DEFAULT_ENSEMBLE
  const parsed = parseInt(match[1], 10)
  if (isNaN(parsed) || parsed < 1) return JUDGE_DEFAULT_ENSEMBLE
  return Math.min(parsed, JUDGE_MAX_ENSEMBLE)
}

export function readJudgeOptions(str) {
  return {
    judgeFamily: readJudgeFamily(str),
    judgeReasoning: readJudgeReasoning(str),
    judgeSamples: readJudgeSamples(str),
    judgeEnsemble: readJudgeEnsemble(str),
  }
}

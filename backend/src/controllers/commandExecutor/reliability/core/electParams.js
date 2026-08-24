import {ELECT_QUERY} from '../../constants/elect'

const N_PATTERN = /:n=(\d+)(?=\s|$)/
const FALLBACK_PATTERN = /:fallback(?=\s|$)/
const JUDGE_REASONING_PATTERN = /:judge_reasoning(?=\s|$)/
const ELECT_CELL_PATTERN = new RegExp(`^${ELECT_QUERY.replace('/', '\\/')}(?:\\s|$)`)
const KNOWN_PARAM_PATTERNS = [N_PATTERN, FALLBACK_PATTERN, JUDGE_REASONING_PATTERN, /:limit=\S+(?=\s|$)/]

/**
 * @param {string} command
 * @returns {number|null} Raw `:n=` integer without range clamping; null when absent or non-numeric.
 */
export const readRawElectN = command => {
  if (!command || !ELECT_CELL_PATTERN.test(command)) return null
  const match = command.match(N_PATTERN)
  return match ? parseInt(match[1], 10) : null
}

/**
 * @param {string} command
 * @returns {number|null} N when `:n=N` is present and N ≥ 2, otherwise null.
 */
export const readElectN = command => {
  const raw = readRawElectN(command)
  return raw !== null && raw >= 2 ? raw : null
}

/**
 * @param {string} command
 * @returns {boolean}
 */
export const readFallbackFlag = command => {
  return typeof command === 'string' && FALLBACK_PATTERN.test(command)
}

export const readJudgeReasoningFlag = command => typeof command === 'string' && JUDGE_REASONING_PATTERN.test(command)

export const readElectTrailingText = command => {
  if (!command || !ELECT_CELL_PATTERN.test(command)) return ''
  let text = command.replace(ELECT_CELL_PATTERN, '')
  for (const pattern of KNOWN_PARAM_PATTERNS) text = text.replace(pattern, '')
  return text.trim()
}

/**
 * @param {string} command
 * @returns {boolean} True only when the command is the /elect keyword (not a
 *   longer name that starts with those characters) and carries a valid :n=N (N ≥ 2).
 */
export const isValidElectCell = command => {
  if (!command) return false
  if (!ELECT_CELL_PATTERN.test(command)) return false
  return readElectN(command) !== null
}

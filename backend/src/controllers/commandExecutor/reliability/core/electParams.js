import {ELECT_QUERY} from '../../constants/elect'

const N_PATTERN = /:n=(\d+)/
const FALLBACK_PATTERN = /:fallback(?=\s|$)/
const JUDGE_REASONING_PATTERN = /:judge_reasoning(?=\s|$)/
const ELECT_CELL_PATTERN = new RegExp(`^${ELECT_QUERY.replace('/', '\\/')}(?:\\s|$)`)

/**
 * @param {string} command
 * @returns {number|null} Raw `:n=` integer without range clamping; null when absent or non-numeric.
 */
export const readRawElectN = command => {
  if (!command) return null
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

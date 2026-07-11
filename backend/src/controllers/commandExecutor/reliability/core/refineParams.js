import {REFINE_QUERY} from '../../constants/refine'

const N_PATTERN = /:n=(\d+)/
const FALLBACK_PATTERN = /:fallback(?=\s|$)/
const REFINE_CELL_PATTERN = new RegExp(`^${REFINE_QUERY.replace('/', '\\/')}(?:\\s|$)`)

/**
 * @param {string} command
 * @returns {number|null} Null when :n= is absent or N < 2 (minimum fork count)
 */
export const readRefineN = command => {
  if (!command) return null
  const match = command.match(N_PATTERN)
  if (!match) return null
  const n = parseInt(match[1], 10)
  return n >= 2 ? n : null
}

/**
 * @param {string} command
 * @returns {boolean}
 */
export const readFallbackFlag = command => {
  return typeof command === 'string' && FALLBACK_PATTERN.test(command)
}

/**
 * @param {string} command
 * @returns {boolean} True only when the command is the /refine keyword (not a
 *   longer name that starts with those characters) and carries a valid :n=N (N ≥ 2).
 */
export const isValidRefineCell = command => {
  if (!command) return false
  if (!REFINE_CELL_PATTERN.test(command)) return false
  return readRefineN(command) !== null
}

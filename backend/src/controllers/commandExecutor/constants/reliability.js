/**
 * Best-of-N reliability parameter constants and utilities
 */

export const RELIABILITY_PARAM_N = ':n='
export const RELIABILITY_PARAM_N_REGEX = ':n=(\\d+)'
export const RELIABILITY_MAX_N = 10
export const RELIABILITY_DEFAULT_N = 1

/**
 * Extract N value from command string (:n=3)
 * @param {string} str - Command string
 * @returns {number} N value (1-10, default 1)
 */
export function readReliabilityN(str) {
  if (!str) return RELIABILITY_DEFAULT_N

  const match = str.match(new RegExp(RELIABILITY_PARAM_N_REGEX))
  if (!match) return RELIABILITY_DEFAULT_N

  const parsed = parseInt(match[1], 10)
  if (isNaN(parsed) || parsed < 1) return RELIABILITY_DEFAULT_N

  return Math.min(parsed, RELIABILITY_MAX_N)
}

export const STEPS_QUERY_TYPE = 'steps'
export const STEPS_QUERY = '/steps'
export const STEPS_PREFIX = '#'
export const STEPS_PREFIX_REGEX = `${STEPS_PREFIX}(-?\\d+)`

// Only a leading order marker (`#10 `, `#-2 `) is a step prefix; a `#N` anywhere later is prompt
// content (an issue number, a ranked count) and must survive. Anchored and non-global so it strips
// exactly one leading marker, mirroring the frontend's command-validator order-prefix pattern.
const STEPS_ORDER_PREFIX_REGEX = /^#-?\d+\s+/

export function clearStepsPrefix(str) {
  return str.trim().replace(STEPS_ORDER_PREFIX_REGEX, '')
}

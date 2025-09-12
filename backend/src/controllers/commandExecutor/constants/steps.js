export const STEPS_QUERY_TYPE = 'steps'
export const STEPS_QUERY = '/steps'
export const STEPS_PREFIX = '#'
export const STEPS_PREFIX_REGEX = `${STEPS_PREFIX}(-?\\d+)`

export function clearStepsPrefix(str) {
  return str.replace(new RegExp(STEPS_PREFIX_REGEX, 'g'), '').trim()
}

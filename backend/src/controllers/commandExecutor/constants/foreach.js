export const FOREACH_QUERY_TYPE = 'foreach'
export const FOREACH_QUERY = '/foreach'
export const FOREACH_FILE_PARAM = '--file'

export const ParallelValues = {
  YES: 'yes',
  NO: 'no',
}
export const PARENTS_DEFAULT = 3

export const FOREACH_PARAM_PARALLEL = `--parallel=(${ParallelValues.YES}|${ParallelValues.NO})`
export const FOREACH_PARENTS_REF = '@@parents'
export const FOREACH_PARENTS_REF_REGEXP = `\\s+${FOREACH_PARENTS_REF}($|\\s+)`

export function readParallelParam(str, defaultValue = true) {
  const match = str.match(new RegExp(FOREACH_PARAM_PARALLEL))
  if (!match) {
    return defaultValue
  }
  const matchedValue = match[1]
  const value = ParallelValues[matchedValue.toLocaleUpperCase()]
  if (value) {
    return value === ParallelValues.YES
  }

  return defaultValue
}

export function readParentRef(str) {
  const match = str.match(new RegExp(FOREACH_PARENTS_REF_REGEXP))
  if (!match) {
    return 0
  }

  return PARENTS_DEFAULT
}

export function readForeachFileParam(str) {
  const match = str.match(new RegExp(FOREACH_FILE_PARAM))
  if (!match) {
    return false
  }

  return true
}

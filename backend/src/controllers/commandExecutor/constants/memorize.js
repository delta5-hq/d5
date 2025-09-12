export const MEMORIZE_QUERY = '/memorize'
export const MEMORIZE_QUERY_TYPE = 'memorize'

export const MEMORIZE_PARAM_RECHUNK = '--rechunk'
export const MEMORIZE_PARAM_RECHUNK_REGEX = `${MEMORIZE_PARAM_RECHUNK}(=(true|false))?`
export const MEMORIZE_PARAM_KEEP = '--keep'
export const MEMORIZE_PARAM_KEEP_REGEX = `${MEMORIZE_PARAM_KEEP}(=(true|false))?`
export const MEMORIZE_PARAM_SPLIT = '--split'
export const MEMORIZE_PARAM_SPLIT_REGEX = '--split(=(["\'])(.*?)\\2)?'

export function readRechunkParam(str, defaultValue = false) {
  const match = str.match(new RegExp(MEMORIZE_PARAM_RECHUNK_REGEX))

  if (!match) {
    return defaultValue
  }

  return match[2] === 'true' || !!match[0]
}

export function readKeepParam(str, defaultValue = false) {
  const match = str.match(new RegExp(MEMORIZE_PARAM_KEEP_REGEX))
  if (!match) {
    return defaultValue
  }

  return match[2] === 'true' || !!match[0]
}

export function readSplitParam(str, defaultValue = '\n') {
  const match = str.match(new RegExp(MEMORIZE_PARAM_SPLIT_REGEX))
  if (!match) {
    return undefined
  }

  return match[3] || defaultValue
}

export const OUTLINE_QUERY_TYPE = 'outline'
export const OUTLINE_QUERY = '/outline'

export const OUTLINE_PARAM_WEB = '--web'
export const OUTLINE_PARAM_WEB_REGEX = `${OUTLINE_PARAM_WEB}(=(\\w+))?`
export const OUTLINE_PARAM_DEBUG_LEVEL = '--debuglevel'
export const OUTLINE_PARAM_DEBUG_LEVEL_REGEX = `${OUTLINE_PARAM_DEBUG_LEVEL}=(\\d+)`
export const OUTLINE_PARAM_LEVELS = '--levels'
export const OUTLINE_PARAM_LEVELS_REGEX = `${OUTLINE_PARAM_LEVELS}=(\\d+)`
export const OUTLINE_PARAM_EXT_REGEX = '--ext'
export const OUTLINE_PARAM_SCHOLAR = '--scholar'
export const OUTLINE_PARAM_SCHOLAR_REGEX = `${OUTLINE_PARAM_SCHOLAR}(=(\\w+))?`
export const OUTLINE_PARAM_FROM_WEBSITE = '--href'
export const OUTLINE_PARAM_FROM_WEBSITE_REGEX = `${OUTLINE_PARAM_FROM_WEBSITE}=['"]([^"']+)['"]`
export const OUTLINE_PARAM_SCHOLAR_MIN_YEAR = '--min_year'
export const OUTLINE_PARAM_SCHOLAR_MIN_YEAR_REGEX = `${OUTLINE_PARAM_SCHOLAR_MIN_YEAR}=(\\d+)`
export const OUTLINE_PARAM_SUMMARIZE = '--summarize'
export const OUTLINE_PARAM_SUMMARIZE_REGEX = `${OUTLINE_PARAM_SUMMARIZE}(=(\\w+))?`

export const WEB_DEFAULT = 'xs'
export const SCHOLAR_DEFAULT = 'xs'
export const DEBUG_LEVEL_DEFAULT = 1
export const LEVELS_DEFAULT = 1
export const SCHOLAR_MIN_YEAR_DEFAULT = 1991
export const SUMMARIZE_SIZE_DEFAULT = 'default'
export const SERP_API_SCHOLAR_PARAMS = {
  engine: 'google_scholar',
  resources: ['PDF'],
}
export const DEBUG_LEVEL = {
  Second: 2,
}

export const LEVELS = {
  Second: 2,
  Third: 3,
}

export function readWebParam(str, defaultValue = WEB_DEFAULT) {
  const match = str.match(new RegExp(OUTLINE_PARAM_WEB_REGEX))
  if (!match) {
    return undefined
  }
  return match[2] || defaultValue
}

export function readDebugLevelParam(str, defaultValue = DEBUG_LEVEL_DEFAULT) {
  const match = str.match(new RegExp(OUTLINE_PARAM_DEBUG_LEVEL_REGEX))
  if (!match) {
    return defaultValue
  }
  return Number(match[1])
}

export function readLevelsParam(str, defaultValue = LEVELS_DEFAULT) {
  const match = str.match(new RegExp(OUTLINE_PARAM_LEVELS_REGEX))
  if (!match) {
    return defaultValue
  }
  return Number(match[1])
}

export function readExtParam(str) {
  const match = str.match(new RegExp(OUTLINE_PARAM_EXT_REGEX))
  if (!match) {
    return false
  }
  return true
}

export function readScholarParam(str, defaultValue = SCHOLAR_DEFAULT) {
  const match = str.match(new RegExp(OUTLINE_PARAM_SCHOLAR_REGEX))
  if (!match) {
    return undefined
  }
  return match[2] || defaultValue
}

export function readHrefParam(str, defaultValue = '') {
  const match = str.match(new RegExp(OUTLINE_PARAM_FROM_WEBSITE_REGEX))
  if (!match) {
    return defaultValue
  }
  return match[1]
}

export function readScholarMinYearParam(str, defaultValue = SCHOLAR_MIN_YEAR_DEFAULT) {
  const match = str.match(new RegExp(OUTLINE_PARAM_SCHOLAR_MIN_YEAR_REGEX))
  if (!match) {
    return defaultValue
  }
  return Number(match[1])
}

export function readSummarizeParam(str, defaultValue = SUMMARIZE_SIZE_DEFAULT) {
  const match = str.match(new RegExp(OUTLINE_PARAM_SUMMARIZE_REGEX))
  if (!match) {
    return defaultValue
  }
  return match[2] || defaultValue
}

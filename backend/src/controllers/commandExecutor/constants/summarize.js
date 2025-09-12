export const SUMMARIZE_QUERY_TYPE = 'summarize'
export const SUMMARIZE_QUERY = '/summarize'
export const SUMMARIZE_PARAM_PARENT = '--parent'
export const SUMMARIZE_PARAM_PARENT_REGEX = `(${SUMMARIZE_PARAM_PARENT}(=(\\d+))?)`
export const SUMMARIZE_PARAM_EMBED = '--embed'
export const SUMMARIZE_PARAM_EMBED_REGEX = `${SUMMARIZE_PARAM_EMBED}(=(\\w+))?`

export const SUMMARIZE_PARENT_DEFAULT = 1
export const EMBED_SIZE_DEFAULT = 'default'

export function readSummarizeParentParam(str, defaultValue = SUMMARIZE_PARENT_DEFAULT) {
  const match = str.match(new RegExp(SUMMARIZE_PARAM_PARENT_REGEX))

  if (!match) {
    return 0
  }

  const value = Number(match[3])
  return value === 0 ? 0 : value || defaultValue
}

export function readEmbedParam(str, defaultValue = EMBED_SIZE_DEFAULT) {
  const match = str.match(new RegExp(SUMMARIZE_PARAM_EMBED_REGEX))
  if (!match) {
    return undefined
  }
  return match[2] || defaultValue
}

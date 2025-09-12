export const EXT_QUERY_TYPE = 'ext'
export const EXT_QUERY = '/ext'
export const EXT_PARAM_CONTEXT = '--context'
export const EXT_PARAM_CONTEXT_REGEX = `${EXT_PARAM_CONTEXT}=([\\w]+)`

export const DEFAULT_CONTEXT_NAME = 'default'

export function readExtContextParam(str, defaultValue = DEFAULT_CONTEXT_NAME) {
  const match = str.match(new RegExp(EXT_PARAM_CONTEXT_REGEX))
  if (!match) {
    return defaultValue
  }
  return match[1]
}

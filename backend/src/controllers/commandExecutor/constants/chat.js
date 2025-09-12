export const CHAT_QUERY_TYPE = 'chat'
export const CHAT_QUERY = '/chatgpt'
export const CHAT_PARAM_JOIN = '--join'
export const CHAT_PARAM_TABLE = '--table'
export const CHAT_PARAM_PARENTS = '--parents'
export const CHAT_PARAM_PARENTS_REGEX = `${CHAT_PARAM_PARENTS}=(\\d+)`

export const PARENTS_DEFAULT = 3

export function readJoinParam(str) {
  const match = str.match(new RegExp(CHAT_PARAM_JOIN))
  if (!match) {
    return false
  }
  return true
}

export function readTableParam(str) {
  const match = str.match(new RegExp(CHAT_PARAM_TABLE))
  if (!match) {
    return false
  }
  return true
}

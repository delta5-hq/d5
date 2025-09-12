export const YANDEX_QUERY_TYPE = 'yandex'
export const YANDEX_QUERY = '/yandexgpt'
export const YANDEX_PARAM_JOIN = '--join'
export const YANDEX_PARAM_TABLE = '--table'
export const YANDEX_PARAM_PARENTS_REGEX = '--parents=(\\d+)'

export const PARENTS_DEFAULT = 3

export function readJoinParam(str) {
  const match = str.match(new RegExp(YANDEX_PARAM_JOIN))
  if (!match) {
    return false
  }
  return true
}

export function readTableParam(str) {
  const match = str.match(new RegExp(YANDEX_PARAM_TABLE))
  if (!match) {
    return false
  }
  return true
}

export function readParentsParam(str, defaultValue = PARENTS_DEFAULT) {
  const match = str.match(new RegExp(YANDEX_PARAM_PARENTS_REGEX))
  if (!match) {
    return defaultValue
  }
  return Number(match[1])
}

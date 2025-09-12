export const DOWNLOAD_QUERY_TYPE = 'download'
export const DOWNLOAD_QUERY = '/download'
export const DOWNLOAD_MAX_SIZE = '--max_size'
export const DOWNLOAD_MAX_SIZE_REGEX = `${DOWNLOAD_MAX_SIZE}=(\\w+)`
export const DOWNLOAD_MAX_PAGES = '--max_pages'
export const DOWNLOAD_MAX_PAGES_REGEX = `${DOWNLOAD_MAX_PAGES}=(\\d+)`

export const FILE_MAX_SIZE_DEFAULT = '5mb'
export const FILE_MAX_PAGE_DEFAULT = '100'

export function readMaxSizeParam(str, defaultValue = FILE_MAX_SIZE_DEFAULT) {
  const match = str.match(new RegExp(DOWNLOAD_MAX_SIZE_REGEX))
  if (!match) {
    return defaultValue
  }
  return match[1]
}

export function readMaxPagesParam(str, defaultValue = FILE_MAX_PAGE_DEFAULT) {
  const match = str.match(new RegExp(DOWNLOAD_MAX_PAGES_REGEX))
  if (!match) {
    return defaultValue
  }
  return match[1]
}

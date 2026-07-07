import {clearCommandsWithParams, readCitationParam, readLangParam, readMaxChunksParam} from '../../constants'
import {EXT_QUERY_TYPE, readExtContextParam} from '../../constants/ext'
import {
  OUTLINE_QUERY_TYPE,
  readExtParam,
  readHrefParam,
  readScholarMinYearParam,
  readScholarParam,
  readWebParam,
} from '../../constants/outline'
import {SCHOLAR_QUERY_TYPE} from '../../constants/scholar'
import {WEB_QUERY_TYPE} from '../../constants/web'

const compactArgs = args =>
  Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined && value !== null && value !== ''))

const buildCommonArgs = command =>
  compactArgs({
    lang: readLangParam(command, null),
    citations: readCitationParam(command) || undefined,
    maxChunks: readMaxChunksParam(command, null),
  })

const buildOutlineArgs = command => {
  const scholar = readScholarParam(command)
  const ext = readExtParam(command)

  return compactArgs({
    ...buildCommonArgs(command),
    web: readWebParam(command),
    scholar,
    ext: ext || undefined,
    context: ext ? readExtContextParam(command) : readExtContextParam(command, null),
    href: readHrefParam(command),
    minYear: scholar ? readScholarMinYearParam(command) : readScholarMinYearParam(command, null),
  })
}

export const buildInternalResearchToolStaticArgs = (queryType, command = '') => {
  const commonArgs = buildCommonArgs(command)

  if (queryType === WEB_QUERY_TYPE) {
    return commonArgs
  }

  if (queryType === SCHOLAR_QUERY_TYPE) {
    return compactArgs({
      ...commonArgs,
      minYear: readScholarMinYearParam(command),
    })
  }

  if (queryType === EXT_QUERY_TYPE) {
    return compactArgs({
      ...commonArgs,
      context: readExtContextParam(command),
    })
  }

  if (queryType === OUTLINE_QUERY_TYPE) {
    return buildOutlineArgs(command)
  }

  return {}
}

export const cleanInternalResearchPrompt = prompt => clearCommandsWithParams(prompt || '')

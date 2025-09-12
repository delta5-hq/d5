import {CHAT_PARAM_JOIN, CHAT_PARAM_TABLE, CHAT_QUERY, CHAT_QUERY_TYPE} from './chat'
import {CLAUDE_QUERY, CLAUDE_QUERY_TYPE} from './claude'
import {EXT_PARAM_CONTEXT_REGEX, EXT_QUERY, EXT_QUERY_TYPE} from './ext'
import {DEEPSEEK_QUERY, DEEPSEEK_QUERY_TYPE} from './deepseek'
import {FOREACH_FILE_PARAM, FOREACH_QUERY, FOREACH_QUERY_TYPE} from './foreach'
import {Lang} from './localizedPrompts'
import {
  OUTLINE_PARAM_DEBUG_LEVEL_REGEX,
  OUTLINE_PARAM_EXT_REGEX,
  OUTLINE_PARAM_FROM_WEBSITE_REGEX,
  OUTLINE_PARAM_LEVELS_REGEX,
  OUTLINE_PARAM_SCHOLAR_MIN_YEAR_REGEX,
  OUTLINE_PARAM_SCHOLAR_REGEX,
  OUTLINE_PARAM_SUMMARIZE_REGEX,
  OUTLINE_PARAM_WEB_REGEX,
  OUTLINE_QUERY,
  OUTLINE_QUERY_TYPE,
} from './outline'
import {QWEN_QUERY, QWEN_QUERY_TYPE} from './qwen'
import {PERPLEXITY_QUERY, PERPLEXITY_QUERY_TYPE} from './perplexity'
import {SCHOLAR_QUERY, SCHOLAR_QUERY_TYPE} from './scholar'
import {STEPS_QUERY, STEPS_QUERY_TYPE, clearStepsPrefix} from './steps'
import {
  SUMMARIZE_PARAM_EMBED_REGEX,
  SUMMARIZE_PARAM_PARENT_REGEX,
  SUMMARIZE_QUERY,
  SUMMARIZE_QUERY_TYPE,
} from './summarize'
import {SWITCH_QUERY, SWITCH_QUERY_TYPE} from './switch'
import {WEB_QUERY, WEB_QUERY_TYPE} from './web'
import {YANDEX_PARAM_JOIN, YANDEX_PARAM_TABLE, YANDEX_QUERY, YANDEX_QUERY_TYPE} from './yandex'
import {DOWNLOAD_MAX_PAGES_REGEX, DOWNLOAD_MAX_SIZE_REGEX, DOWNLOAD_QUERY, DOWNLOAD_QUERY_TYPE} from './download'
import {REF_DEF_PREFIX, REF_PREFIX, HASHREF_DEF_PREFIX, HASHREF_PREFIX} from '../commands/references/referenceConstants'
import {clearReferences} from '../commands/references/utils/referenceUtils'
import {CUSTOM_LLM_CHAT_QUERY, CUSTOM_LLM_CHAT_QUERY_TYPE} from './custom_llm'
import {REFINE_QUERY, REFINE_QUERY_TYPE} from './refine'
import {COMPLETION_QUERY, COMPLETION_QUERY_TYPE} from './completion'
import {
  MEMORIZE_PARAM_KEEP_REGEX,
  MEMORIZE_PARAM_RECHUNK_REGEX,
  MEMORIZE_PARAM_SPLIT_REGEX,
  MEMORIZE_QUERY,
  MEMORIZE_QUERY_TYPE,
} from './memorize'
import {queryCommands} from './commandRegExp'

export const getQueryType = title => {
  const clearedTitle = clearStepsPrefix(title)

  if (clearedTitle.startsWith(YANDEX_QUERY)) {
    return YANDEX_QUERY_TYPE
  } else if (clearedTitle.startsWith(WEB_QUERY)) {
    return WEB_QUERY_TYPE
  } else if (clearedTitle.startsWith(OUTLINE_QUERY)) {
    return OUTLINE_QUERY_TYPE
  } else if (clearedTitle.startsWith(SCHOLAR_QUERY)) {
    return SCHOLAR_QUERY_TYPE
  } else if (clearedTitle.startsWith(STEPS_QUERY)) {
    return STEPS_QUERY_TYPE
  } else if (clearedTitle.startsWith(FOREACH_QUERY)) {
    return FOREACH_QUERY_TYPE
  } else if (clearedTitle.startsWith(SUMMARIZE_QUERY)) {
    return SUMMARIZE_QUERY_TYPE
  } else if (clearedTitle.startsWith(CHAT_QUERY)) {
    return CHAT_QUERY_TYPE
  } else if (clearedTitle.startsWith(SWITCH_QUERY)) {
    return SWITCH_QUERY_TYPE
  } else if (clearedTitle.startsWith(CLAUDE_QUERY)) {
    return CLAUDE_QUERY_TYPE
  } else if (clearedTitle.startsWith(QWEN_QUERY)) {
    return QWEN_QUERY_TYPE
  } else if (clearedTitle.startsWith(PERPLEXITY_QUERY)) {
    return PERPLEXITY_QUERY_TYPE
  } else if (clearedTitle.startsWith(EXT_QUERY)) {
    return EXT_QUERY_TYPE
  } else if (clearedTitle.startsWith(DOWNLOAD_QUERY)) {
    return DOWNLOAD_QUERY_TYPE
  } else if (clearedTitle.startsWith(DEEPSEEK_QUERY)) {
    return DEEPSEEK_QUERY_TYPE
  } else if (clearedTitle.startsWith(CUSTOM_LLM_CHAT_QUERY)) {
    return CUSTOM_LLM_CHAT_QUERY_TYPE
  } else if (clearedTitle.startsWith(REFINE_QUERY)) {
    return REFINE_QUERY_TYPE
  } else if (clearedTitle.startsWith(COMPLETION_QUERY)) {
    return COMPLETION_QUERY_TYPE
  } else if (clearedTitle.startsWith(MEMORIZE_QUERY)) {
    return MEMORIZE_QUERY_TYPE
  }
}

export {REF_DEF_PREFIX, REF_PREFIX, HASHREF_DEF_PREFIX, HASHREF_PREFIX, clearReferences}

export const allowedCommands = [
  YANDEX_QUERY_TYPE,
  WEB_QUERY_TYPE,
  SCHOLAR_QUERY_TYPE,
  OUTLINE_QUERY_TYPE,
  STEPS_QUERY_TYPE,
  CHAT_QUERY_TYPE,
  SUMMARIZE_QUERY_TYPE,
  FOREACH_QUERY_TYPE,
  SWITCH_QUERY_TYPE,
  CLAUDE_QUERY_TYPE,
  QWEN_QUERY_TYPE,
  PERPLEXITY_QUERY_TYPE,
  DEEPSEEK_QUERY_TYPE,
  CUSTOM_LLM_CHAT_QUERY_TYPE,
  REFINE_QUERY_TYPE,
  EXT_QUERY_TYPE,
  MEMORIZE_QUERY_TYPE,
]

export const LANG_PARAM = '--lang'
export const LANG_PARAM_REGEX = `${LANG_PARAM}=([a-zA-Z]+)`
export const LANG_DEFAULT_VALUE = Lang.en

export function readLangParam(str, defaultValue = '') {
  const match = str.match(new RegExp(LANG_PARAM_REGEX))
  if (!match) {
    return defaultValue
  }
  return match[1]
}

export const CITATION_PARAM = '--citation'
export const CITATIONS_STRING = 'Citations'

export function readCitationParam(str) {
  const match = str.match(new RegExp(CITATION_PARAM))
  if (!match) {
    return false
  }
  return true
}

export const CHUNK_SIZE = {
  xxl: 'xxl',
  xl: 'xl',
  l: 'l',
  s: 's',
  xs: 'xs',
  xxs: 'xxs',
}

export function calculateMaxChunksFromSize(str) {
  switch (str.toLowerCase()) {
    case CHUNK_SIZE.xxl:
      return 20
    case CHUNK_SIZE.xl:
      return 15
    case CHUNK_SIZE.l:
      return 10
    case CHUNK_SIZE.s:
      return 8
    case CHUNK_SIZE.xs:
      return 4
    case CHUNK_SIZE.xxs:
      return 1
    default:
      return 4
  }
}

export const CHUNK_SIZE_REGEX = `\\s*--(${Object.keys(CHUNK_SIZE).join('|')})\\b`

export function readMaxChunksParam(str, defaultValue = CHUNK_SIZE.xs) {
  const match = str.match(new RegExp(CHUNK_SIZE_REGEX))
  if (!match) {
    return defaultValue
  }
  return match[1]
}

export const clearCommandsWithParams = str => {
  const clearCommand = str => {
    return str.replace(new RegExp(queryCommands.join('|'), 'g'), '')
  }

  const clearCommandParams = str => {
    const commadParamsRegExp = new RegExp(
      [
        YANDEX_PARAM_JOIN,
        YANDEX_PARAM_TABLE,
        LANG_PARAM_REGEX,
        CHUNK_SIZE_REGEX,
        CITATION_PARAM,
        OUTLINE_PARAM_DEBUG_LEVEL_REGEX,
        OUTLINE_PARAM_EXT_REGEX,
        OUTLINE_PARAM_FROM_WEBSITE_REGEX,
        OUTLINE_PARAM_LEVELS_REGEX,
        OUTLINE_PARAM_SCHOLAR_MIN_YEAR_REGEX,
        OUTLINE_PARAM_SCHOLAR_REGEX,
        OUTLINE_PARAM_WEB_REGEX,
        OUTLINE_PARAM_SUMMARIZE_REGEX,
        CHAT_PARAM_JOIN,
        CHAT_PARAM_TABLE,
        SUMMARIZE_PARAM_PARENT_REGEX,
        SUMMARIZE_PARAM_EMBED_REGEX,
        FOREACH_FILE_PARAM,
        DOWNLOAD_MAX_PAGES_REGEX,
        DOWNLOAD_MAX_SIZE_REGEX,
        EXT_PARAM_CONTEXT_REGEX,
        MEMORIZE_PARAM_RECHUNK_REGEX,
        MEMORIZE_PARAM_KEEP_REGEX,
        MEMORIZE_PARAM_SPLIT_REGEX,
      ].join('|'),
      'g',
    )
    return str.replace(commadParamsRegExp, '')
  }

  return clearCommandParams(clearCommand(str)).trim()
}

export const CODE_BLOCK_REGEX = /```[a-z]*\n([\s\S]*?)\n```/g

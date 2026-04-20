export const STEP_PREFIX = '#'
export const STEP_PREFIX_REGEX = `${STEP_PREFIX}(-?\\d+)`

export const YANDEX_QUERY = '/yandexgpt'
export const WEB_QUERY = '/web'
export const SCHOLAR_QUERY = '/scholar'
export const OUTLINE_QUERY = '/outline'
export const EXT_QUERY = '/ext'
export const STEPS_QUERY = '/steps'
export const SUMMARIZE_QUERY = '/summarize'
export const FOREACH_QUERY = '/foreach'
export const CHAT_QUERY = '/chatgpt'
export const SWITCH_QUERY = '/switch'
export const CASE_QUERY = '/case'
export const CLAUDE_QUERY = '/claude'
export const QWEN_QUERY = '/qwen'
export const PERPLEXITY_QUERY = '/perplexity'
export const DOWNLOAD_QUERY = '/download'
export const DEEPSEEK_QUERY = '/deepseek'
export const CUSTOM_LLM_CHAT_QUERY = '/custom'
export const REFINE_QUERY = '/refine'
export const COMPLETION_QUERY = '/chat'
export const MEMORIZE_QUERY = '/memorize'

export const SUPPORTED_COMMANDS = [
  YANDEX_QUERY,
  WEB_QUERY,
  SCHOLAR_QUERY,
  OUTLINE_QUERY,
  EXT_QUERY,
  STEPS_QUERY,
  SUMMARIZE_QUERY,
  FOREACH_QUERY,
  CHAT_QUERY,
  SWITCH_QUERY,
  CASE_QUERY,
  CLAUDE_QUERY,
  QWEN_QUERY,
  PERPLEXITY_QUERY,
  DOWNLOAD_QUERY,
  DEEPSEEK_QUERY,
  CUSTOM_LLM_CHAT_QUERY,
  REFINE_QUERY,
  COMPLETION_QUERY,
  MEMORIZE_QUERY,
] as const

export type CommandQuery = (typeof SUPPORTED_COMMANDS)[number]

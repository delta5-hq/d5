import { COMMAND_TO_QUERYTYPE_MAP } from '../command-querytype-mapper'

export type { CommandQuery } from '../command-querytype-mapper'

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
export const ELECT_QUERY = '/elect'
export const VALIDATE_QUERY = '/validate'
export const COMPLETION_QUERY = '/chat'
export const MCP_FUSION_QUERY = '/mcp'
export const MEMORIZE_QUERY = '/memorize'

export const SUPPORTED_COMMANDS = Object.keys(COMMAND_TO_QUERYTYPE_MAP) as (keyof typeof COMMAND_TO_QUERYTYPE_MAP)[]

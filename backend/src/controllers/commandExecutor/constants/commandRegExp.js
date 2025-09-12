import {CHAT_QUERY} from './chat'
import {CLAUDE_QUERY} from './claude'
import {FOREACH_QUERY} from './foreach'
import {OUTLINE_QUERY} from './outline'
import {PERPLEXITY_QUERY} from './perplexity'
import {QWEN_QUERY} from './qwen'
import {SCHOLAR_QUERY} from './scholar'
import {STEPS_QUERY} from './steps'
import {SUMMARIZE_QUERY} from './summarize'
import {SWITCH_QUERY, CASE_QUERY} from './switch'
import {WEB_QUERY} from './web'
import {YANDEX_QUERY} from './yandex'
import {STEPS_PREFIX_REGEX} from './steps'
import {DOWNLOAD_QUERY} from './download'
import {DEEPSEEK_QUERY} from './deepseek'
import {CUSTOM_LLM_CHAT_QUERY} from './custom_llm'
import {REFINE_QUERY} from './refine'
import {COMPLETION_QUERY} from './completion'
import {MEMORIZE_QUERY} from './memorize'
import {EXT_QUERY} from './ext'

export const queryCommands = [
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
]

const createCommandRegex = (commandPrefix, withOrder = false) => {
  const prefixPattern = Array.isArray(commandPrefix) ? commandPrefix.join('|') : commandPrefix
  const orderPart = withOrder ? `(${STEPS_PREFIX_REGEX}\\s+)?` : ''
  return new RegExp(`^\\s*${orderPart}(${prefixPattern})(\\s+|$)`, '')
}

/**
 * Regular expression patterns for command parsing in the application.
 *
 * This object contains getter methods that return RegExp objects for matching
 * different types of commands in text content.
 *
 * Each command has two variants:
 * - Standard pattern: Matches the command without order specification
 * - WithOrder pattern: Includes ordering information in the match
 */
export const commandRegExp = {
  /**
   * Matches any command pattern (e.g., /chatgpt, /summarize, etc.)
   * @returns RegExp that matches any command at the start of a string
   */
  get any() {
    return createCommandRegex(queryCommands)
  },

  /**
   * Matches any command pattern with optional order prefix (e.g., #1 /chatgpt, /summarize)
   * @returns RegExp that matches any command optionally preceded by an order number
   */
  get anyWithOrder() {
    return createCommandRegex(queryCommands, true)
  },

  /**
   * Matches chatgpt command pattern
   * @returns RegExp that matches /chatgpt command at the start of a string
   */
  get chatgpt() {
    return createCommandRegex(CHAT_QUERY)
  },

  /**
   * Matches chatgpt command pattern with optional order prefix
   * @returns RegExp that matches /chatgpt command optionally preceded by an order number
   */
  get chatgptWithOrder() {
    return createCommandRegex(CHAT_QUERY, true)
  },

  /**
   * Matches web command pattern
   * @returns RegExp that matches /web command at the start of a string
   */
  get web() {
    return createCommandRegex(WEB_QUERY)
  },

  /**
   * Matches web command pattern with optional order prefix
   * @returns RegExp that matches /web command optionally preceded by an order number
   */
  get webWithOrder() {
    return createCommandRegex(WEB_QUERY, true)
  },

  /**
   * Matches scholar command pattern
   * @returns RegExp that matches /scholar command at the start of a string
   */
  get scholar() {
    return createCommandRegex(SCHOLAR_QUERY)
  },

  /**
   * Matches scholar command pattern with optional order prefix
   * @returns RegExp that matches /scholar command optionally preceded by an order number
   */
  get scholarWithOrder() {
    return createCommandRegex(SCHOLAR_QUERY, true)
  },

  /**
   * Matches outline command pattern
   * @returns RegExp that matches /outline command at the start of a string
   */
  get outline() {
    return createCommandRegex(OUTLINE_QUERY)
  },

  /**
   * Matches outline command pattern with optional order prefix
   * @returns RegExp that matches /outline command optionally preceded by an order number
   */
  get outlineWithOrder() {
    return createCommandRegex(OUTLINE_QUERY, true)
  },

  /**
   * Matches ext command pattern
   * @returns RegExp that matches /ext command at the start of a string
   * @example '/ext command' -> matches
   */
  get ext() {
    return createCommandRegex(EXT_QUERY)
  },

  /**
   * Matches ext command pattern with optional order prefix
   * @returns RegExp that matches /ext command optionally preceded by an order number
   * @example '#4 /ext command' -> matches
   */
  get extWithOrder() {
    return createCommandRegex(EXT_QUERY, true)
  },

  /**
   * Matches steps command pattern
   * @returns RegExp that matches /steps command at the start of a string
   */
  get steps() {
    return createCommandRegex(STEPS_QUERY)
  },

  /**
   * Matches steps command pattern with optional order prefix
   * @returns RegExp that matches /steps command optionally preceded by an order number
   */
  get stepsWithOrder() {
    return createCommandRegex(STEPS_QUERY, true)
  },

  /**
   * Matches summarize command pattern
   * @returns RegExp that matches /summarize command at the start of a string
   */
  get summarize() {
    return createCommandRegex(SUMMARIZE_QUERY)
  },

  /**
   * Matches summarize command pattern with optional order prefix
   * @returns RegExp that matches /summarize command optionally preceded by an order number
   */
  get summarizeWithOrder() {
    return createCommandRegex(SUMMARIZE_QUERY, true)
  },

  /**
   * Matches foreach command pattern
   * @returns RegExp that matches /foreach command at the start of a string
   */
  get foreach() {
    return createCommandRegex(FOREACH_QUERY)
  },

  /**
   * Matches foreach command pattern with optional order prefix
   * @returns RegExp that matches /foreach command optionally preceded by an order number
   */
  get foreachWithOrder() {
    return createCommandRegex(FOREACH_QUERY, true)
  },

  /**
   * Matches switch command pattern
   * @returns RegExp that matches /switch command at the start of a string
   */
  get switch() {
    return createCommandRegex(SWITCH_QUERY)
  },

  /**
   * Matches switch command pattern with optional order prefix
   * @returns RegExp that matches /switch command optionally preceded by an order number
   */
  get switchWithOrder() {
    return createCommandRegex(SWITCH_QUERY, true)
  },

  /**
   * Matches case command pattern
   * @returns RegExp that matches /case command at the start of a string
   */
  get case() {
    return createCommandRegex(CASE_QUERY)
  },

  /**
   * Matches case command pattern with optional order prefix
   * @returns RegExp that matches /case command optionally preceded by an order number
   */
  get caseWithOrder() {
    return createCommandRegex(CASE_QUERY, true)
  },

  /**
   * Matches yandex command pattern
   * @returns RegExp that matches /yandex command at the start of a string
   */
  get yandex() {
    return createCommandRegex(YANDEX_QUERY)
  },

  /**
   * Matches yandex command pattern with optional order prefix
   * @returns RegExp that matches /yandex command optionally preceded by an order number
   */
  get yandexWithOrder() {
    return createCommandRegex(YANDEX_QUERY, true)
  },

  /**
   * Matches claude command pattern
   * @returns RegExp that matches /claude command at the start of a string
   */
  get claude() {
    return createCommandRegex(CLAUDE_QUERY)
  },

  /**
   * Matches claude command pattern with optional order prefix
   * @returns RegExp that matches /claude command optionally preceded by an order number
   */
  get claudeWithOrder() {
    return createCommandRegex(CLAUDE_QUERY, true)
  },

  /**
   * Matches qwen command pattern
   * @returns RegExp that matches /qwen command at the start of a string
   */
  get qwen() {
    return createCommandRegex(QWEN_QUERY)
  },

  /**
   * Matches qwen command pattern with optional order prefix
   * @returns RegExp that matches /qwen command optionally preceded by an order number
   */
  get qwenWithOrder() {
    return createCommandRegex(QWEN_QUERY, true)
  },

  /**
   * Matches perplexity command pattern
   * @returns RegExp that matches /perplexity command at the start of a string
   */
  get perplexity() {
    return createCommandRegex(PERPLEXITY_QUERY)
  },

  /**
   * Matches perplexity command pattern with optional order prefix
   * @returns RegExp that matches /perplexity command optionally preceded by an order number
   */
  get perplexityWithOrder() {
    return createCommandRegex(PERPLEXITY_QUERY, true)
  },

  /**
   * Matches download command pattern
   * @returns RegExp that matches /download command at the start of a string
   */
  get download() {
    return createCommandRegex(DOWNLOAD_QUERY)
  },

  /**
   * Matches download command pattern with optional order prefix
   * @returns RegExp that matches /download command optionally preceded by an order number
   */
  get downloadWithOrder() {
    return createCommandRegex(DOWNLOAD_QUERY, true)
  },

  /**
   * Matches custom llm chat command pattern
   * @returns RegExp that matches /custom command at the start of a string
   * @example '/custom hello' -> matches, '/outline hello' -> doesn't match
   */
  get customLLMChat() {
    return createCommandRegex(CUSTOM_LLM_CHAT_QUERY)
  },

  /**
   * Matches custom llm chat command pattern with optional order prefix
   * @returns RegExp that matches /custom command optionally preceded by an order number
   * @example '#1 /custom hello' -> matches, '/custom hello' -> matches
   */
  get customLLMChatWithOrder() {
    return createCommandRegex(CUSTOM_LLM_CHAT_QUERY, true)
  },

  /**
   * Matches refine command pattern
   * @returns RegExp that matches /refine command at the start of a string
   * @example '/refine hello' -> matches, '/outline hello' -> doesn't match
   */
  get refine() {
    return createCommandRegex(REFINE_QUERY)
  },

  /**
   * Matches refine command pattern with optional order prefix
   * @returns RegExp that matches /refine command optionally preceded by an order number
   * @example '#1 /refine hello' -> matches, '/refine hello' -> matches
   */
  get refineWithOrder() {
    return createCommandRegex(REFINE_QUERY, true)
  },

  /**
   * Matches refine command pattern
   * @returns RegExp that matches /chat command at the start of a string
   * @example '/chat hello' -> matches, '/outline hello' -> doesn't match
   */
  get completion() {
    return createCommandRegex(COMPLETION_QUERY)
  },

  /**
   * Matches refine command pattern with optional order prefix
   * @returns RegExp that matches /chat command optionally preceded by an order number
   * @example '#1 /chat hello' -> matches, '/chat hello' -> matches
   */
  get completionWithOrder() {
    return createCommandRegex(COMPLETION_QUERY, true)
  },

  /**
   * Matches memorize command pattern
   * @returns RegExp that matches /memorize command at the start of a string
   */
  get memorize() {
    return createCommandRegex(MEMORIZE_QUERY)
  },

  /**
   * Matches memorize command pattern with optional order prefix
   * @returns RegExp that matches /memorize command optionally preceded by an order number
   */
  get memorizeWithOrder() {
    return createCommandRegex(MEMORIZE_QUERY, true)
  },
}

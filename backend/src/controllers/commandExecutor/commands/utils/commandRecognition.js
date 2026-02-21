import {commandRegExp, queryCommands} from '../../constants/commandRegExp'

/**
 * @typedef {Object} DynamicAlias
 * @property {string} alias - The command alias (e.g., "/coder1")
 */

const STEPS_ORDER_PREFIX = /^#-?\d+\s+/

/**
 * Normalizes text by stripping order prefix and trimming whitespace
 * @param {string} text
 * @returns {string}
 */
const normalizeText = text => {
  if (!text) return ''
  return text.trimStart().replace(STEPS_ORDER_PREFIX, '')
}

/**
 * Checks if normalized text matches an alias with word boundary
 * @param {string} normalizedText
 * @param {string} alias
 * @returns {boolean}
 */
const hasWordBoundary = (normalizedText, alias) => {
  if (!normalizedText.startsWith(alias)) return false
  if (normalizedText.length === alias.length) return true
  return /\s/.test(normalizedText[alias.length])
}

/**
 * Determines if text starts with any built-in command prefix
 * @param {string} text
 * @returns {boolean}
 */
export const matchesBuiltInCommand = text => {
  if (!text) return false
  return commandRegExp.any.test(text)
}

/**
 * Determines if text starts with any built-in command prefix (with optional order)
 * @param {string} text
 * @returns {boolean}
 */
export const matchesBuiltInCommandWithOrder = text => {
  if (!text) return false
  return commandRegExp.anyWithOrder.test(text)
}

/**
 * Determines if text starts with a dynamic alias
 * @param {string} text
 * @param {DynamicAlias[]} aliases
 * @returns {boolean}
 */
export const matchesDynamicAlias = (text, aliases = []) => {
  if (!text || !aliases || !aliases.length) return false
  const normalized = normalizeText(text)
  return aliases.some(({alias}) => hasWordBoundary(normalized, alias))
}

/**
 * Determines if text is any command (built-in or dynamic alias)
 * @param {string} text
 * @param {DynamicAlias[]} dynamicAliases
 * @returns {boolean}
 */
export const isAnyCommand = (text, dynamicAliases = []) => {
  return matchesBuiltInCommand(text) || matchesDynamicAlias(text, dynamicAliases)
}

/**
 * Determines if text is any command with optional order prefix
 * @param {string} text
 * @param {DynamicAlias[]} dynamicAliases
 * @returns {boolean}
 */
export const isAnyCommandWithOrder = (text, dynamicAliases = []) => {
  return matchesBuiltInCommandWithOrder(text) || matchesDynamicAlias(text, dynamicAliases)
}

/**
 * Extracts the command prefix from text (built-in only)
 * @param {string} text
 * @returns {string|null} - The matched command prefix or null
 */
export const extractBuiltInCommandPrefix = text => {
  if (!text) return null
  const trimmed = text.trimStart()
  for (const prefix of queryCommands) {
    if (trimmed.startsWith(prefix)) {
      return prefix
    }
  }
  return null
}

/**
 * Extracts the dynamic alias from text
 * @param {string} text
 * @param {DynamicAlias[]} aliases
 * @returns {DynamicAlias|null}
 */
export const extractDynamicAlias = (text, aliases = []) => {
  if (!text || !aliases.length) return null
  const normalized = normalizeText(text)
  return aliases.find(({alias}) => hasWordBoundary(normalized, alias)) || null
}

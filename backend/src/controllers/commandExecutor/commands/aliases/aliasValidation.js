import {queryCommands} from '../../constants/commandRegExp'

const VALID_ALIAS_PATTERN = /^\/[a-zA-Z][a-zA-Z0-9_-]*$/
const BUILT_IN_COMMANDS = new Set(queryCommands)

/**
 * @param {string} alias
 * @returns {boolean}
 */
export const isValidAlias = alias => {
  if (!alias || !alias.startsWith('/')) return false
  if (BUILT_IN_COMMANDS.has(alias)) return false
  return VALID_ALIAS_PATTERN.test(alias)
}

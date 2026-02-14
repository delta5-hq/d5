import Integration from '../../../../models/Integration'
import {queryCommands} from '../../constants/commandRegExp'

/**
 * @typedef {Object} MCPAliasConfig
 * @property {string} alias
 * @property {string} serverUrl
 * @property {string} transport
 * @property {string} toolName
 * @property {string} [toolInputField]
 * @property {Object} [toolStaticArgs]
 * @property {Object} [headers]
 * @property {string} [description]
 */

/**
 * @param {string} userId
 * @returns {Promise<MCPAliasConfig[]>}
 */
export const loadMCPAliases = async userId => {
  const integration = await Integration.findOne({userId}).lean()
  if (!integration?.mcp?.length) {
    return []
  }

  return integration.mcp.filter(entry => isValidAlias(entry.alias))
}

/**
 * @param {MCPAliasConfig[]} aliases
 * @param {string} queryType
 * @returns {MCPAliasConfig|undefined}
 */
export const findAliasByQueryType = (aliases, queryType) => {
  return aliases.find(entry => queryTypeFromAlias(entry.alias) === queryType)
}

/** @param {string} alias — e.g. "/coder1" → "mcp:coder1" */
export const queryTypeFromAlias = alias => `mcp:${alias.replace(/^\//, '')}`

const BUILT_IN_PREFIXES = new Set(queryCommands)

const isValidAlias = alias => {
  if (!alias || !alias.startsWith('/')) return false
  if (BUILT_IN_PREFIXES.has(alias)) return false
  return /^\/[a-zA-Z][a-zA-Z0-9_-]*$/.test(alias)
}

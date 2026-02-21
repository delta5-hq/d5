import {getQueryType as getBuiltInQueryType} from '../../constants'
import {extractDynamicAlias} from './commandRecognition'

/**
 * @typedef {Object} DynamicAlias
 * @property {string} alias - The command alias (e.g., "/coder1")
 */

/**
 * Converts MCP alias to queryType format
 * @param {string} alias - e.g., "/coder1"
 * @returns {string} - e.g., "mcp:coder1"
 */
export const mcpAliasToQueryType = alias => `mcp:${alias.replace(/^\//, '')}`

/**
 * Converts RPC alias to queryType format
 * @param {string} alias - e.g., "/vm3"
 * @returns {string} - e.g., "rpc:vm3"
 */
export const rpcAliasToQueryType = alias => `rpc:${alias.replace(/^\//, '')}`

/**
 * Resolves queryType from title, checking built-in commands first, then dynamic aliases
 * @param {string} title - The command text
 * @param {Object} options
 * @param {DynamicAlias[]} [options.mcpAliases=[]] - MCP aliases to check
 * @param {DynamicAlias[]} [options.rpcAliases=[]] - RPC aliases to check
 * @returns {string|undefined} - The queryType or undefined if not recognized
 */
export const resolveQueryType = (title, {mcpAliases = [], rpcAliases = []} = {}) => {
  if (!title) return undefined

  // First check built-in commands (existing behavior)
  const builtInQueryType = getBuiltInQueryType(title)
  if (builtInQueryType) return builtInQueryType

  // Then check MCP aliases
  const mcpAlias = extractDynamicAlias(title, mcpAliases)
  if (mcpAlias) return mcpAliasToQueryType(mcpAlias.alias)

  // Finally check RPC aliases
  const rpcAlias = extractDynamicAlias(title, rpcAliases)
  if (rpcAlias) return rpcAliasToQueryType(rpcAlias.alias)

  return undefined
}

/**
 * Finds MCP alias config by queryType
 * @param {DynamicAlias[]} aliases
 * @param {string} queryType - e.g., "mcp:coder1"
 * @returns {DynamicAlias|undefined}
 */
export const findMCPAliasByQueryType = (aliases, queryType) => {
  if (!queryType?.startsWith('mcp:')) return undefined
  const expectedAlias = `/${queryType.replace(/^mcp:/, '')}`
  return aliases.find(a => a.alias === expectedAlias)
}

/**
 * Finds RPC alias config by queryType
 * @param {DynamicAlias[]} aliases
 * @param {string} queryType - e.g., "rpc:vm3"
 * @returns {DynamicAlias|undefined}
 */
export const findRPCAliasByQueryType = (aliases, queryType) => {
  if (!queryType?.startsWith('rpc:')) return undefined
  const expectedAlias = `/${queryType.replace(/^rpc:/, '')}`
  return aliases.find(a => a.alias === expectedAlias)
}

/**
 * @param {string} title
 * @param {{mcp: DynamicAlias[], rpc: DynamicAlias[]}} aliases
 * @returns {{queryType: string|undefined, mcpAlias: DynamicAlias|undefined, rpcAlias: DynamicAlias|undefined}}
 */
export const resolveCommand = (title, {mcp = [], rpc = []} = {}) => {
  const queryType = resolveQueryType(title, {mcpAliases: mcp, rpcAliases: rpc})
  return {
    queryType,
    mcpAlias: findMCPAliasByQueryType(mcp, queryType),
    rpcAlias: findRPCAliasByQueryType(rpc, queryType),
  }
}

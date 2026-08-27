import {getControlFlowQueryType, getLLMQueryType} from '../../constants'
import {extractDynamicAlias} from './commandRecognition'

/**
 * @typedef {Object} DynamicAlias
 * @property {string} alias - The command alias (e.g., "/coder1")
 */

const MCP_PREFIX = 'mcp:'
const RPC_PREFIX = 'rpc:'

export const isMCPQueryType = queryType => queryType?.startsWith(MCP_PREFIX) ?? false
export const isRPCQueryType = queryType => queryType?.startsWith(RPC_PREFIX) ?? false

export const mcpAliasToQueryType = alias => `${MCP_PREFIX}${alias.replace(/^\//, '')}`
export const rpcAliasToQueryType = alias => `${RPC_PREFIX}${alias.replace(/^\//, '')}`

/**
 * Resolves queryType with category-aware priority:
 * 1. Control-flow built-ins (NON-overridable: steps, foreach, switch, summarize, elect, memorize)
 * 2. User aliases (MCP/RPC - CAN override LLM built-ins)
 * 3. LLM built-ins (overridable: chat, claude, qwen, web, scholar, etc.)
 *
 * @param {string} title - The command text
 * @param {Object} options
 * @param {DynamicAlias[]} [options.mcpAliases=[]] - MCP aliases to check
 * @param {DynamicAlias[]} [options.rpcAliases=[]] - RPC aliases to check
 * @returns {string|undefined} - The queryType or undefined if not recognized
 */
export const resolveQueryType = (title, {mcpAliases = [], rpcAliases = []} = {}) => {
  if (!title) return undefined

  const controlFlowType = getControlFlowQueryType(title)
  if (controlFlowType) return controlFlowType

  const mcpAlias = extractDynamicAlias(title, mcpAliases)
  if (mcpAlias) return mcpAliasToQueryType(mcpAlias.alias)

  const rpcAlias = extractDynamicAlias(title, rpcAliases)
  if (rpcAlias) return rpcAliasToQueryType(rpcAlias.alias)

  const llmType = getLLMQueryType(title)
  if (llmType) return llmType

  return undefined
}

/**
 * @param {DynamicAlias[]} aliases
 * @param {string} queryType - e.g., "mcp:coder1"
 * @returns {DynamicAlias|undefined}
 */
export const findMCPAliasByQueryType = (aliases, queryType) => {
  if (!isMCPQueryType(queryType)) return undefined
  const expectedAlias = `/${queryType.replace(/^mcp:/, '')}`
  return aliases.find(a => a.alias === expectedAlias)
}

/**
 * @param {DynamicAlias[]} aliases
 * @param {string} queryType - e.g., "rpc:vm3"
 * @returns {DynamicAlias|undefined}
 */
export const findRPCAliasByQueryType = (aliases, queryType) => {
  if (!isRPCQueryType(queryType)) return undefined
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

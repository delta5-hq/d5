/**
 * @typedef {Object} DynamicAlias
 * @property {string} alias
 */

/**
 * @typedef {Object} AliasRegistry
 * @property {DynamicAlias[]} mcp
 * @property {DynamicAlias[]} rpc
 */

/**
 * Composes all dynamic aliases from registry into flat array
 * @param {AliasRegistry} aliasRegistry
 * @returns {DynamicAlias[]}
 */
export const composeAllDynamicAliases = aliasRegistry => {
  if (!aliasRegistry) return []
  const {mcp = [], rpc = []} = aliasRegistry
  return [...mcp, ...rpc]
}

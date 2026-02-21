import Integration from '../../../../models/Integration'
import {queryCommands} from '../../constants/commandRegExp'

const VALID_ALIAS_PATTERN = /^\/[a-zA-Z][a-zA-Z0-9_-]*$/
const BUILT_IN_PREFIXES = new Set(queryCommands)

const isValidAlias = alias => {
  if (!alias || !alias.startsWith('/')) return false
  if (BUILT_IN_PREFIXES.has(alias)) return false
  return VALID_ALIAS_PATTERN.test(alias)
}

export const loadUserAliases = async userId => {
  const integration = await Integration.findOne({userId}).lean()

  if (!integration) {
    return {mcp: [], rpc: []}
  }

  return {
    mcp: (integration.mcp || []).filter(entry => isValidAlias(entry.alias)),
    rpc: (integration.rpc || []).filter(entry => isValidAlias(entry.alias)),
  }
}

import Integration from '../../../../models/Integration'
import {isValidAlias} from './aliasValidation'

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

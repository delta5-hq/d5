import {isValidAlias} from './aliasValidation'
import SessionHydrator from './SessionHydrator'
import IntegrationFacade from '../../../../repositories/IntegrationFacade'

export const loadUserAliases = async (userId, workflowId = null) => {
  const merged = await IntegrationFacade.findDecrypted(userId, workflowId)

  if (!merged) {
    return {mcp: [], rpc: []}
  }

  const aliases = {
    mcp: (merged.mcp || []).filter(entry => isValidAlias(entry.alias)),
    rpc: (merged.rpc || []).filter(entry => isValidAlias(entry.alias)),
  }

  return SessionHydrator.hydrateAll(userId, aliases)
}

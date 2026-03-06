import {isValidAlias} from './aliasValidation'
import SessionHydrator from './SessionHydrator'
import IntegrationFacade from '../../../../repositories/IntegrationFacade'

export const loadUserAliases = async (userId, workflowId = null) => {
  const decrypted = await IntegrationFacade.findDecrypted(userId, workflowId)

  if (!decrypted) {
    return {mcp: [], rpc: []}
  }

  const aliases = {
    mcp: (decrypted.mcp || []).filter(entry => isValidAlias(entry.alias)),
    rpc: (decrypted.rpc || []).filter(entry => isValidAlias(entry.alias)),
  }

  return SessionHydrator.hydrateAll(userId, aliases)
}

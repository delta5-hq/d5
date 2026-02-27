import {INTEGRATION_ENCRYPTION_CONFIG} from '../../../../models/Integration'
import {isValidAlias} from './aliasValidation'
import {decryptFields} from '../../../../models/utils/fieldEncryption'
import SessionHydrator from './SessionHydrator'
import IntegrationRepository from '../../../../repositories/IntegrationRepository'

export const loadUserAliases = async (userId, workflowId = null) => {
  const integration = await IntegrationRepository.findWithFallback(userId, workflowId)

  if (!integration) {
    return {mcp: [], rpc: []}
  }

  const decrypted = decryptFields(integration, INTEGRATION_ENCRYPTION_CONFIG)

  const aliases = {
    mcp: (decrypted.mcp || []).filter(entry => isValidAlias(entry.alias)),
    rpc: (decrypted.rpc || []).filter(entry => isValidAlias(entry.alias)),
  }

  return SessionHydrator.hydrateAll(userId, aliases)
}

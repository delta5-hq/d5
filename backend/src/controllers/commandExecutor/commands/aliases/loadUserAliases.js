import Integration, {INTEGRATION_ENCRYPTION_CONFIG} from '../../../../models/Integration'
import {isValidAlias} from './aliasValidation'
import {decryptFields} from '../../../../models/utils/fieldEncryption'

export const loadUserAliases = async userId => {
  const integration = await Integration.findOne({userId}).lean()

  if (!integration) {
    return {mcp: [], rpc: []}
  }

  const decrypted = decryptFields(integration, INTEGRATION_ENCRYPTION_CONFIG)

  return {
    mcp: (decrypted.mcp || []).filter(entry => isValidAlias(entry.alias)),
    rpc: (decrypted.rpc || []).filter(entry => isValidAlias(entry.alias)),
  }
}

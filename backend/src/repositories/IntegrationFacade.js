import {INTEGRATION_ENCRYPTION_CONFIG} from '../models/Integration'
import {decryptFields} from '../models/utils/fieldEncryption'
import IntegrationRepository from './IntegrationRepository'

export class IntegrationFacade {
  async findDecrypted(userId, workflowId = null) {
    const integration = await IntegrationRepository.findWithFallback(userId, workflowId)

    if (!integration) {
      return null
    }

    return decryptFields(integration, INTEGRATION_ENCRYPTION_CONFIG)
  }

  async findDecryptedOrThrow(userId, workflowId = null) {
    const decrypted = await this.findDecrypted(userId, workflowId)

    if (!decrypted) {
      throw new Error('Integration not found')
    }

    return decrypted
  }
}

export default new IntegrationFacade()

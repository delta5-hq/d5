import {INTEGRATION_ENCRYPTION_CONFIG} from '../models/Integration'
import {decryptFields} from '../models/utils/fieldEncryption'
import IntegrationRepository from './IntegrationRepository'
import IntegrationMerger from './IntegrationMerger'

export class IntegrationFacade {
  async findDecrypted(userId, workflowId = null) {
    const {appWide, workflow} = await IntegrationRepository.findBothDocs(userId, workflowId)

    const decryptedAppWide = appWide
      ? decryptFields(appWide, INTEGRATION_ENCRYPTION_CONFIG, {userId, workflowId: null})
      : null

    const decryptedWorkflow = workflow
      ? decryptFields(workflow, INTEGRATION_ENCRYPTION_CONFIG, {userId, workflowId})
      : null

    return IntegrationMerger.merge(decryptedAppWide, decryptedWorkflow)
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

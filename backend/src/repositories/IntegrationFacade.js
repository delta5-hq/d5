import {INTEGRATION_ENCRYPTION_CONFIG} from '../models/Integration'
import {decryptFields} from '../models/utils/fieldEncryption'
import IntegrationRepository from './IntegrationRepository'
import IntegrationMerger from './IntegrationMerger'
import {mergeIntegrations} from './IntegrationMerger'

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

  async findMergedDecrypted(userId, workflowId = null) {
    const result = await this.findMergedDecryptedWithMetadata(userId, workflowId)
    return result.merged
  }

  async findMergedDecryptedWithMetadata(userId, workflowId = null) {
    if (!workflowId) {
      const merged = await this.findDecrypted(userId, null)
      return {merged, workflowDoc: null}
    }

    const globalDoc = await IntegrationRepository.findByUser(userId)
    const workflowDoc = await IntegrationRepository.findByWorkflow(userId, workflowId)

    const decryptedGlobal = globalDoc
      ? decryptFields(globalDoc, INTEGRATION_ENCRYPTION_CONFIG, {
          userId,
          workflowId: null,
        })
      : null

    const decryptedWorkflow = workflowDoc
      ? decryptFields(workflowDoc, INTEGRATION_ENCRYPTION_CONFIG, {
          userId,
          workflowId,
        })
      : null

    return {
      merged: mergeIntegrations(decryptedGlobal, decryptedWorkflow),
      workflowDoc: decryptedWorkflow,
    }
  }
}

export default new IntegrationFacade()

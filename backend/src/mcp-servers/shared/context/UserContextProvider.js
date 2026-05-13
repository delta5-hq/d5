import IntegrationFacade from '../../../repositories/IntegrationFacade'

export class UserContextProvider {
  constructor(userId, workflowId = null) {
    this.userId = userId
    this.workflowId = workflowId
  }

  getUserId() {
    return this.userId
  }

  getWorkflowId() {
    return this.workflowId
  }

  async getIntegrationSettings() {
    return IntegrationFacade.findDecryptedOrThrow(this.userId, this.workflowId)
  }
}

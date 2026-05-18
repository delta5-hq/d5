import {loadIntegrationSettings} from '../../../controllers/commandExecutor/commands/utils/langchain/IntegrationSettingsLoader'

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
    return loadIntegrationSettings(this.userId, this.workflowId)
  }
}

import Integration from '../models/Integration'

export class IntegrationRepository {
  async findByWorkflow(userId, workflowId) {
    if (!workflowId) {
      return null
    }
    return Integration.findOne({userId, workflowId}).lean()
  }

  async findByUser(userId) {
    return Integration.findOne({userId, workflowId: null}).lean()
  }

  async findWithFallback(userId, workflowId) {
    if (!workflowId) {
      return this.findByUser(userId)
    }

    const workflowSpecific = await this.findByWorkflow(userId, workflowId)
    if (workflowSpecific) {
      return workflowSpecific
    }

    return this.findByUser(userId)
  }
}

export default new IntegrationRepository()

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

  async findBothDocs(userId, workflowId) {
    if (!workflowId) {
      const appWide = await this.findByUser(userId)
      return {appWide, workflow: null}
    }

    const [appWide, workflow] = await Promise.all([this.findByUser(userId), this.findByWorkflow(userId, workflowId)])

    return {appWide, workflow}
  }
}

export default new IntegrationRepository()

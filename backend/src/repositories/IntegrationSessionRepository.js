import IntegrationSession from '../models/IntegrationSession'

export class IntegrationSessionRepository {
  async findSession(userId, alias, protocol) {
    return IntegrationSession.findOne({userId, alias, protocol}).lean()
  }

  async upsertSessionId(userId, alias, protocol, sessionId) {
    return IntegrationSession.findOneAndUpdate(
      {userId, alias, protocol},
      {$set: {lastSessionId: sessionId}},
      {upsert: true, new: true},
    )
  }

  async getLastSessionId(userId, alias, protocol) {
    const session = await this.findSession(userId, alias, protocol)
    return session?.lastSessionId || null
  }
}

export default new IntegrationSessionRepository()

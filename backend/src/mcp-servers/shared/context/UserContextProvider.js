import IntegrationFacade from '../../../repositories/IntegrationFacade'

export class UserContextProvider {
  constructor(userId) {
    this.userId = userId
  }

  getUserId() {
    return this.userId
  }

  async getIntegrationSettings() {
    return IntegrationFacade.findDecryptedOrThrow(this.userId, null)
  }
}

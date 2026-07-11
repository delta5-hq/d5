import mongoose from 'mongoose'
import Integration from '../../../../../../models/Integration'
import IntegrationSession from '../../../../../../models/IntegrationSession'
import {encryptFields} from '../../../../../../models/utils/fieldEncryption'
import {INTEGRATION_ENCRYPTION_CONFIG} from '../../../../../../models/Integration'

export class DatabaseFixtures {
  constructor(databaseUri) {
    this.databaseUri = databaseUri
    this.isConnected = false
    this._borrowedConnection = false
  }

  async connect() {
    if (this.isConnected) return
    if (mongoose.connection.readyState === 1) {
      this.isConnected = true
      this._borrowedConnection = true
      return
    }
    await mongoose.connect(this.databaseUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    this.isConnected = true
  }

  async disconnect() {
    if (!this.isConnected || this._borrowedConnection) return
    await mongoose.disconnect()
    this.isConnected = false
  }

  async dropDatabase() {
    if (!this.isConnected || this._borrowedConnection) return
    await mongoose.connection.dropDatabase()
  }

  async insertIntegration(rawDoc) {
    const {userId, workflowId} = rawDoc
    const encrypted = encryptFields(rawDoc, INTEGRATION_ENCRYPTION_CONFIG, {userId, workflowId})
    return Integration.create(encrypted)
  }

  async insertSession({userId, alias, protocol, lastSessionId}) {
    return IntegrationSession.create({userId, alias, protocol, lastSessionId})
  }

  async cleanupUserData(userId) {
    if (!this.isConnected) return
    await Integration.deleteMany({userId})
    await IntegrationSession.deleteMany({userId})
  }

  async cleanup() {
    if (this._borrowedConnection) return
    await this.dropDatabase()
    await this.disconnect()
  }
}

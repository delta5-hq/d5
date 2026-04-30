import mongoose from 'mongoose'
import createSchema from './utils/createSchema'

const IntegrationSessionSchema = createSchema({
  userId: {type: String, required: true, index: true},
  alias: {type: String, required: true},
  protocol: {type: String, required: true, enum: ['rpc', 'mcp']},
  lastSessionId: {type: String},
})

IntegrationSessionSchema.index({userId: 1, alias: 1, protocol: 1}, {unique: true})

const IntegrationSession = mongoose.model('IntegrationSession', IntegrationSessionSchema)

export default IntegrationSession

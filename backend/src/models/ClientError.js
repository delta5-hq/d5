import mongoose from 'mongoose'
import createSchema from './utils/createSchema'

const ClientErrorSchema = createSchema({
  path: String,
  userId: String,
  backtrace: String,
  additions: Object,
})

const ClientError = mongoose.model('ClientError', ClientErrorSchema)

export default ClientError

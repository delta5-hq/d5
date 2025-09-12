import debug from 'debug'
import mongoose from 'mongoose'

const log = debug('delta5:app:rest:healthStatus')
const logError = log.extend('ERROR*', '::')

const healthStatus = async ctx => {
  const {readyState, states} = mongoose.connection
  if (readyState !== states.connected) {
    const message = `health probe failed. MongoDB state: ${states[readyState]}`
    logError(message)
    ctx.body = message
    ctx.status = 503
  } else {
    ctx.status = 200
  }
}

export default healthStatus

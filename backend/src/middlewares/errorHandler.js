import debug from 'debug'

const log = debug('delta5:app:rest:errorHandler')
const logError = log.extend('ERROR*', '::')

const errorHandler = async (ctx, next) => {
  try {
    await next()
  } catch (err) {
    ctx.status = err.status || 500
    ctx.body = {
      message: err.message,
    }
    if (err.id) ctx.body.id = err.id
    if (!err.status) {
      logError(`Unhandled error occured: ${err.stack}`, ctx)
    } else {
      logError(`Error occured with status '${ctx.status}': ${err.message}`)
    }
  }
}

export default errorHandler

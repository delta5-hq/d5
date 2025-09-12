import debug from 'debug'

const log = debug('delta5:app:rest:extractUserId')

const extractUserId = async (ctx, next) => {
  const {jwtOriginalError, auth} = ctx.state
  const {message} = jwtOriginalError || {}

  if (message && message !== 'jwt must be provided') {
    log('jwt not valid', {message})
    ctx.throw(401, message)
  } else if (auth) {
    ctx.state.userId = auth.sub?.toString()
  }
  await next()
}

export default extractUserId

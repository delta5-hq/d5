/**
 * Sets CORS headers on the response
 * @param {Object} ctx - Koa context
 * @param {string} [origin] - Origin to allow, defaults to request origin or '*'
 */
const setCorsHeaders = (ctx, origin = ctx.request.headers.origin || '*') => {
  ctx.set('Access-Control-Allow-Origin', origin)
  ctx.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
  ctx.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  ctx.set('Access-Control-Allow-Credentials', 'true')
}

/**
 * CORS middleware that adds appropriate headers to responses
 */
export const corsMiddleware = () => async (ctx, next) => {
  setCorsHeaders(ctx)

  if (ctx.method === 'OPTIONS') {
    ctx.status = 200
    return
  }

  await next()
}

/**
 * Handler for OPTIONS preflight requests
 */
export const handleCorsPreflightRequest = async ctx => {
  setCorsHeaders(ctx)
  ctx.status = 200
}

// For backward compatibility
export const cors = corsMiddleware
export default corsMiddleware

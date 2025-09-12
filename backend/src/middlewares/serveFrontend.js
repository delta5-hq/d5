import serve from 'koa-static'
import {FRONTEND_PATH} from '../constants'
import {API_BASE_PATH} from '../shared/config/constants'

const serveMiddleware = serve(FRONTEND_PATH)

const serveFrontend = (ctx, next) => {
  const rewriteNext = async () => {
    // if the serve middleware did not return, that means it did not find a static file
    // so serve the index file and let the frontend router decide
    if (!ctx.path.startsWith(API_BASE_PATH)) {
      ctx.path = 'index.html'
      await serveMiddleware(ctx, next)
    } else {
      await next()
    }
  }
  return serveMiddleware(ctx, rewriteNext)
}

export default serveFrontend

import Router from '@koa/router'
import jwt from 'koa-jwt'

import {API_BASE_PATH} from '../shared/config/constants'
import {corsMiddleware, handleCorsPreflightRequest} from '../middlewares/cors'

import {JWT_SECRET} from '../constants'
import extractUserId from '../middlewares/extractUserId'
import integrationRouter from './integrationRouter'
import executorRouter from './executorRouter'
import progressStreamRouter from './progressStreamRouter'

const apiRouter = new Router({prefix: API_BASE_PATH})

apiRouter.options('/execute', handleCorsPreflightRequest)

const corsExecutorRouter = new Router()
corsExecutorRouter.use(corsMiddleware()).use(executorRouter.routes(), executorRouter.allowedMethods())

apiRouter
  .use(
    jwt({
      key: 'auth',
      cookie: 'auth',
      secret: JWT_SECRET,
      passthrough: true,
      debug: true,
      getToken: ctx => ctx.cookies.get('auth') || ctx.headers.authorization?.split(' ')[1],
    }),
  )
  .use(extractUserId)
  .use(integrationRouter.routes(), integrationRouter.allowedMethods())
  .use(corsExecutorRouter.routes(), corsExecutorRouter.allowedMethods())
  .use(progressStreamRouter.routes(), progressStreamRouter.allowedMethods())

export default apiRouter

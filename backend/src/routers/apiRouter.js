import Router from '@koa/router'
import jwt from 'koa-jwt'

import {API_BASE_PATH} from '../shared/config/constants'
import {corsMiddleware, handleCorsPreflightRequest} from '../middlewares/cors'

import userRouter from './userRouter'
import errorRouter from './errorRouter'
import workflowRouter from './workflowRouter'
import templateRouter from './templateRouter'
import UserController from '../controllers/UserController'
import {JWT_SECRET} from '../constants'
import extractUserId from '../middlewares/extractUserId'
import authenticationRouter from './authenticationRouter'
import syncRouter from './syncRouter'
import statisticsRouter from './statisticsRouter'
import urlThumbnailRouter from './urlThumbnailRouter'
import integrationRouter from './integrationRouter'
import executorRouter from './executorRouter'
import macroRouter from './macroRouter'
import llmVectorRouter from './llmVectorRouter'

const apiRouter = new Router({prefix: API_BASE_PATH})

apiRouter.options('/execute', handleCorsPreflightRequest)
apiRouter.options('/macro/(.*)', handleCorsPreflightRequest)

const corsExecutorRouter = new Router()
corsExecutorRouter.use(corsMiddleware()).use(executorRouter.routes(), executorRouter.allowedMethods())

const corsMacroRouter = new Router()
corsMacroRouter.use(corsMiddleware()).use(macroRouter.routes(), macroRouter.allowedMethods())

apiRouter
  .use(authenticationRouter.routes(), authenticationRouter.allowedMethods())
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
  .use(syncRouter.routes(), syncRouter.allowedMethods())
  .use(errorRouter.routes(), errorRouter.allowedMethods())
  .use(UserController.authorization)
  .use(workflowRouter.routes(), workflowRouter.allowedMethods())
  .use(templateRouter.routes(), templateRouter.allowedMethods())
  .use(corsMacroRouter.routes(), corsMacroRouter.allowedMethods())
  .use(userRouter.routes(), userRouter.allowedMethods())
  .use(statisticsRouter.routes(), statisticsRouter.allowedMethods())
  .use(urlThumbnailRouter.routes(), urlThumbnailRouter.allowedMethods())
  .use(integrationRouter.routes(), integrationRouter.allowedMethods())
  .use(corsExecutorRouter.routes(), corsExecutorRouter.allowedMethods())
  .use(llmVectorRouter.routes(), llmVectorRouter.allowedMethods())

export default apiRouter

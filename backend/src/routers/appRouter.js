import Router from '@koa/router'

import apiRouter from './apiRouter'
import unauthRouter from './unauthRouter'
import {BASE_URL} from '../constants'

const appRouter = new Router({
  prefix: BASE_URL ? `/${BASE_URL}` : '',
})

appRouter.use(unauthRouter.routes()).use(apiRouter.routes()).use(apiRouter.allowedMethods())

export default appRouter

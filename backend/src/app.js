import Koa from 'koa'
import queryString from 'koa-qs'
import bodyParser from 'koa-body-parsers'
import debug from 'debug'

import appRouter from './routers/appRouter'
import serveFrontend from './middlewares/serveFrontend'
import logger from 'koa-logger'
import monitoring from './middlewares/prometheus'
import compress from 'koa-compress'
import errorHandler from './middlewares/errorHandler'

const log = debug('delta5:app:rest*')
const logError = log.extend('ERROR*', '::')

const app = queryString(bodyParser(new Koa({proxy: true})))

app
  .on('error', err => logError('error event caught', err.message, err.stack))
  .use(logger(string => log(string)))
  .use(monitoring())
  .use(compress())
  .use(errorHandler)
  .use(appRouter.routes())
  .use(appRouter.allowedMethods())

// static serving is not used in production!
if (process.env.NODE_ENV !== 'production') {
  app.use(serveFrontend)
}

export default app

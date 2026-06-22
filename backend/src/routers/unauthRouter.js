import Router from '@koa/router'
import {API_BASE_PATH} from '../shared/config/constants'
import healthStatus from '../middlewares/healthStatus'
import serveMetrics from '../middlewares/serveMetrics'
import buildRevision from '../middlewares/buildRevision'

// separate router for infrastructure related requests, as it does not use the prefix and does not need authentication
const unauthRouter = new Router()

unauthRouter.get([`${API_BASE_PATH}/healthz`, '/healthz'], healthStatus)
unauthRouter.get('/metrics', serveMetrics)
unauthRouter.get([`${API_BASE_PATH}/revision`, '/revision'], buildRevision)

export default unauthRouter

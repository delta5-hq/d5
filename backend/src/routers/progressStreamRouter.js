import Router from '@koa/router'
import ProgressStreamController from '../controllers/ProgressStreamController'

const progressStreamRouter = new Router({prefix: '/progress'})

progressStreamRouter.get('/stream', ProgressStreamController.stream)

export default progressStreamRouter

import Router from '@koa/router'
import ExecutorController from '../controllers/commandExecutor/ExecutorController'
import StreamController from '../controllers/commandExecutor/StreamController'

const executorRouter = new Router({prefix: '/execute'})

executorRouter.post('/', ExecutorController.execute)
executorRouter.get('/stream', StreamController.stream)

export default executorRouter

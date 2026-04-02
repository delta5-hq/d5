import Router from '@koa/router'
import ExecutorController from '../controllers/commandExecutor/ExecutorController'
import StreamController from '../controllers/commandExecutor/StreamController'
import PreviewController from '../controllers/commandExecutor/PreviewController'

const executorRouter = new Router({prefix: '/execute'})

executorRouter.post('/', ExecutorController.execute)
executorRouter.get('/stream', StreamController.stream)
executorRouter.post('/preview', PreviewController.resolveReferences)

export default executorRouter

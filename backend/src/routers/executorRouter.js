import Router from '@koa/router'
import ExecutorController from '../controllers/commandExecutor/ExecutorController'
import PreviewController from '../controllers/commandExecutor/PreviewController'

const executorRouter = new Router({prefix: '/execute'})

executorRouter.post('/', ExecutorController.execute)
executorRouter.post('/preview', PreviewController.resolveReferences)

export default executorRouter

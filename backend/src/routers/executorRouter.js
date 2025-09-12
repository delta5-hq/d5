import Router from '@koa/router'
import ExecutorController from '../controllers/commandExecutor/ExecutorController'

const executorRouter = new Router({prefix: '/execute'})

executorRouter.post('/', ExecutorController.execute)

export default executorRouter

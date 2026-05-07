import Router from '@koa/router'
import JudgeEvalController from '../controllers/commandExecutor/JudgeEvalController'

const judgeRouter = new Router({prefix: '/judge'})

judgeRouter.post('/eval', JudgeEvalController.evaluate)

export default judgeRouter

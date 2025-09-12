import Router from '@koa/router'

import LLMVectorController from '../controllers/LLMVectorController'

const llmVectorRouter = new Router({prefix: '/vector'})

llmVectorRouter
  .get('/', LLMVectorController.get)
  .get('/all', LLMVectorController.getAll)
  .post('/', LLMVectorController.save)
  .delete('/', LLMVectorController.delete)
  .get('/overview', LLMVectorController.overview)

export default llmVectorRouter

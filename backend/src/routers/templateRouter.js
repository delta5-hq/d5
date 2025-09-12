import Router from '@koa/router'

import TemplateController from '../controllers/TemplateController'
import imageRouter from './imageRouter'

const templateRouter = new Router({prefix: '/templates'})

templateRouter
  .get('/', TemplateController.list)
  .post('/', TemplateController.create)

  .use('/:templateId', TemplateController.load)
  .use('/:templateId', TemplateController.authorization)
  .get('/:templateId', TemplateController.get)
  .put('/:templateId', TemplateController.create)
  .delete('/:templateId', TemplateController.delete)
  .patch('/:templateId', TemplateController.update)

  .use('/:templateId', imageRouter.routes(), imageRouter.allowedMethods())

export default templateRouter

import Router from '@koa/router'

import WorkflowController from '../controllers/WorkflowController'
import fileRouter from './fileRouter'
import imageRouter from './imageRouter'
import pathRouter from './pathRouter'
import TemplateController from '../controllers/TemplateController'
import videoRouter from './videoRouter'

const workflowRouter = new Router({prefix: '/workflow'})

workflowRouter
  .get('/', WorkflowController.list)
  .post('/', WorkflowController.create)
  .use('/from/template/:templateId', TemplateController.load)
  .use('/from/template/:templateId', TemplateController.authorizationRead)
  .post('/from/template/:templateId', WorkflowController.fromTemplate)

  .use('/:workflowId', WorkflowController.load)
  .use('/:workflowId', WorkflowController.authorization)
  .get('/:workflowId', WorkflowController.get)
  .delete('/:workflowId', WorkflowController.delete)

  .get('/:workflowId/export', WorkflowController.exportJson)
  .get('/:workflowId/export/json', WorkflowController.exportJson)
  .get('/:workflowId/export/zip', WorkflowController.exportZip)
  .get('/:workflowId/share', WorkflowController.shareRead)
  .post('/:workflowId/share', WorkflowController.shareWrite)
  .get('/:workflowId/share/access', WorkflowController.shareAccessGet)
  .post('/:workflowId/share/access', WorkflowController.shareAccessPost)
  .get('/:workflowId/share/public', WorkflowController.sharePublicGet)
  .post('/:workflowId/share/public', WorkflowController.sharePublicPost)
  .post('/:workflowId/category', WorkflowController.addCategory)
  .get('/:workflowId/writeable', WorkflowController.writeable)
  .get('/:workflowId/nodeLimit', WorkflowController.nodeLimit)

  .use('/:workflowId', fileRouter.routes(), fileRouter.allowedMethods())
  .use('/:workflowId', imageRouter.routes(), imageRouter.allowedMethods())
  .use('/:workflowId', pathRouter.routes(), pathRouter.allowedMethods())
  .use('/:workflowId', videoRouter.routes(), videoRouter.allowedMethods())

export default workflowRouter

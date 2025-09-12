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

  .use('/:mapId', WorkflowController.load)
  .use('/:mapId', WorkflowController.authorization)
  .get('/:mapId', WorkflowController.get)
  .delete('/:mapId', WorkflowController.delete)

  .get('/:mapId/export', WorkflowController.exportJson)
  .get('/:mapId/export/json', WorkflowController.exportJson)
  .get('/:mapId/export/zip', WorkflowController.exportZip)
  .get('/:mapId/share', WorkflowController.shareRead)
  .post('/:mapId/share', WorkflowController.shareWrite)
  .get('/:mapId/share/access', WorkflowController.shareAccessGet)
  .post('/:mapId/share/access', WorkflowController.shareAccessPost)
  .get('/:mapId/share/public', WorkflowController.sharePublicGet)
  .post('/:mapId/share/public', WorkflowController.sharePublicPost)
  .post('/:mapId/category', WorkflowController.addCategory)
  .get('/:mapId/writeable', WorkflowController.writeable)
  .get('/:mapId/nodeLimit', WorkflowController.nodeLimit)

  .use('/:mapId', fileRouter.routes(), fileRouter.allowedMethods())
  .use('/:mapId', imageRouter.routes(), imageRouter.allowedMethods())
  .use('/:mapId', pathRouter.routes(), pathRouter.allowedMethods())
  .use('/:mapId', videoRouter.routes(), videoRouter.allowedMethods())

export default workflowRouter

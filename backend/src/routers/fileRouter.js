import Router from '@koa/router'

import FileController from '../controllers/FileController'
import fileThumbnailRouter from './fileThumbnailRouter'

const fileRouter = new Router({prefix: '/files'})

fileRouter
  .get('/', FileController.list)
  .get('/info', FileController.listInfo)
  .post('/', FileController.create)

  .use('/:fileId', FileController.load)
  .use('/:fileId', FileController.authorization)

  .get('/:fileId', FileController.get)
  .delete('/:fileId', FileController.delete)

  .get('/:fileId/hash', FileController.hash)

  .use('/:fileId', fileThumbnailRouter.routes(), fileThumbnailRouter.allowedMethods())

export default fileRouter

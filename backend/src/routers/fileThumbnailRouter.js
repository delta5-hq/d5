import Router from '@koa/router'
import FileThumbnailController from '../controllers/FileThumbnailController'

const fileThumbnailRouter = new Router({prefix: '/thumbnail'})

fileThumbnailRouter.use('/', FileThumbnailController.load).get('/', FileThumbnailController.get)

export default fileThumbnailRouter

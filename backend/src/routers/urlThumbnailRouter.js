import Router from '@koa/router'

import UrlThumbnailController from '../controllers/UrlThumbnailController'

const urlThumbnailRouter = new Router({prefix: '/url/thumbnail'})

urlThumbnailRouter.get('/', UrlThumbnailController.get)

export default urlThumbnailRouter

import Router from '@koa/router'

import ImageController from '../controllers/ImageController'

const imageRouter = new Router({prefix: '/images'})

imageRouter
  .get('/', ImageController.list)
  .post('/', ImageController.create)

  .use('/:imageId', ImageController.load)
  .use('/:imageId', ImageController.authorization)
  .get('/:imageId', ImageController.get)
  .delete('/:imageId', ImageController.delete)

export default imageRouter

import Router from '@koa/router'

import PathController from '../controllers/PathController'

const pathRouter = new Router({prefix: '/paths'})

pathRouter
  .get('/', PathController.list)
  .post('/', PathController.create)

  .use('/:pathId', PathController.load)
  .get('/:pathId', PathController.get)
  .put('/:pathId', PathController.create)
  .delete('/:pathId', PathController.delete)

export default pathRouter

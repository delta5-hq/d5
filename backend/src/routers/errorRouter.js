import Router from '@koa/router'

import ClientErrorController from '../controllers/ClientErrorController'

const errorRouter = new Router({prefix: '/errors'})

errorRouter.post('/', ClientErrorController.create).get('/', ClientErrorController.list)

export default errorRouter

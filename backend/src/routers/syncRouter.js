import Router from '@koa/router'
import SyncController from '../controllers/SyncController'

const syncRouter = new Router({prefix: '/sync'})

syncRouter
  .use(SyncController.authorization)
  .post('/users', SyncController.allUser)
  .post('/userMetaData', SyncController.allUserMetaData)

export default syncRouter

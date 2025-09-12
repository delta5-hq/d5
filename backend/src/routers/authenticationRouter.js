import Router from '@koa/router'

import AuthController from '../controllers/AuthController'

const authenticationRouter = new Router()

authenticationRouter
  .post('/auth', AuthController.auth)
  .post('/external-auth', AuthController.externalAuth)
  .post(['/refresh', '/auth/refresh'], AuthController.refresh)
  .post('/external-auth/refresh', AuthController.externalRefresh)
  .get('/auth/login', AuthController.login)
  .post('/auth/signup', AuthController.signup)
  .post('/auth/logout', AuthController.logout)
  .post('/auth/forgot-password', AuthController.forgotPassword)
  .get('/auth/check-reset-token/:pwdResetToken', AuthController.checkResetToken)
  .post('/auth/reset-password/:pwdResetToken', AuthController.resetPassword)

export default authenticationRouter

import Router from '@koa/router'
import StatisticsController from '../controllers/StatisticsController'

const statisticsRouter = new Router({prefix: '/statistics'})

statisticsRouter
  .use(StatisticsController.authorization)
  .get('/workflow', StatisticsController.workflowServe)
  .get('/workflow/download', StatisticsController.workflowCsv)

  .post('/waitlist/confirm/all', StatisticsController.activateUsersBatch)
  .get('/waitlist/confirm/:waitUserId', StatisticsController.approveWaitlistUser)
  .post('/waitlist/reject/all', StatisticsController.activateUsersBatch)
  .get('/waitlist/reject/:waitUserId', StatisticsController.rejectWaitlistUser)

  .param('userId', StatisticsController.userLoad)
  .get('/workflow/:userId', StatisticsController.userWorkflowStatistics)
  .get('/users', StatisticsController.userList)
  .get('/users/activity', StatisticsController.userActivity)
  .get('/users/:userId', StatisticsController.userStatistics)
  .post('/users/:userId/comment', StatisticsController.userComment)
  .get('/waitlist', StatisticsController.userWaitlist)

export default statisticsRouter

import Router from '@koa/router'
import IntegrationController from '../controllers/IntegrationController'
import OpenAIController from '../controllers/integrations/OpenAIController'
import ClaudeController from '../controllers/integrations/claude/ClaudeController'

const integrationRouter = new Router({prefix: '/integration'})

integrationRouter
  .use(IntegrationController.authorization)
  .get('/', IntegrationController.getAll)
  .put('/:service/update', IntegrationController.updateService)
  .post('/scrape_v2', IntegrationController.scrapeV2)
  .post('/scrape_files', IntegrationController.scrapeFiles)
  .post('/translate', IntegrationController.translate)
  .get('/search', IntegrationController.search)
  .post('/downloadImage', IntegrationController.downloadImage)
  .post('/images/generations', OpenAIController.dalleGenerations)
  .post('/claude/messages', ClaudeController.sendMessages)

export default integrationRouter

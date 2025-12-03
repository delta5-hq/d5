import Router from '@koa/router'
import IntegrationController from '../controllers/IntegrationController'
import OpenAIController from '../controllers/integrations/OpenAIController'

const integrationRouter = new Router({prefix: '/integration'})

integrationRouter
  .use(IntegrationController.authorization)
  .post('/scrape_v2', IntegrationController.scrapeV2)
  .post('/scrape_files', IntegrationController.scrapeFiles)
  .post('/translate', IntegrationController.translate)
  .get('/search', IntegrationController.search)
  .post('/downloadImage', IntegrationController.downloadImage)
  .post('/images/generations', OpenAIController.dalleGenerations)

export default integrationRouter

import Router from '@koa/router'
import IntegrationController from '../controllers/IntegrationController'
import MidjourneyController from '../controllers/integrations/MidjourneyController'
import FreepikController from '../controllers/integrations/FreepikController'
import OpenAIController from '../controllers/integrations/OpenAIController'
import ZoomController from '../controllers/integrations/ZoomController'
import YandexController from '../controllers/integrations/yandex/YandexController'
import ClaudeController from '../controllers/integrations/ClaudeController'
import {PerplexityController} from '../controllers/integrations/PerplexityController'

const integrationRouter = new Router({prefix: '/integration'})

integrationRouter
  .post('/scrape_v2', IntegrationController.scrapeV2)
  .post('/scrape_files', IntegrationController.scrapeFiles)
  .post('/translate', IntegrationController.translate)
  .use(IntegrationController.authorization)
  .get('/search', IntegrationController.search)
  .get('/', IntegrationController.getAll)
  .post('/downloadImage', IntegrationController.downloadImage)
  // Yandex
  .post('/yandex/completion', YandexController.yandexCompletion)
  .post('/yandex/embeddings', YandexController.embeddings)
  // OpenAI
  .get('/openai_api_key', OpenAIController.checkOpenaiApiKey)
  .post('/chat/completions', OpenAIController.chatCompletions)
  .post('/embeddings', OpenAIController.embeddings)
  .post('/images/generations', OpenAIController.dalleGenerations)
  // Freepik
  .get('/icons/freepik', FreepikController.getIcons)
  .post('/icons/download', FreepikController.downloadIcon)
  // Midjourney
  .post('/midjourney/create', MidjourneyController.create)
  .post('/midjourney/upscale', MidjourneyController.upscale)
  // Zoom
  .post('/zoom/auth', ZoomController.auth)
  .get('/zoom/meetings/:id/recordings', ZoomController.getRecordings)
  // Claude
  .post('/claude/messages', ClaudeController.sendMessages)
  // Perplexity
  .post('/perplexity/chat/completions', PerplexityController.completions)
  // Apps & Integrations
  .get('/languages', IntegrationController.getLanguages)
  .post('/language', IntegrationController.setLanguage)
  .post('/model', IntegrationController.setModel)
  .get('/:service', IntegrationController.getService)
  .put('/:service/update', IntegrationController.updateService)

if (process.env.NODE_ENV !== 'production') {
  integrationRouter.use(IntegrationController.authorization).delete('/', IntegrationController.deleteIntegration)
}

export default integrationRouter

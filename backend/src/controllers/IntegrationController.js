import googleTranslate from '@iamtraction/google-translate'
import Integration, {INTEGRATION_ENCRYPTION_CONFIG} from '../models/Integration'
import {SERP_API_KEY} from '../constants'
import querystring from 'querystring'
import fetch from 'node-fetch'
import sharp from 'sharp'
import {validateLang} from './utils/validateLang'
import {encryptFields} from '../models/utils/fieldEncryption'
import {LANGUAGES, MODELS, USER_DEFAULT_LANGUAGE, USER_DEFAULT_MODEL} from '../shared/config/constants'
import {PhraseChunkBuilderV2, scrapeFiles, fetchAsString} from './utils/scrape'
import LLMVector from '../models/LLMVector'
import IntegrationRepository from '../repositories/IntegrationRepository'
import IntegrationFacade from '../repositories/IntegrationFacade'
import {normalizeWorkflowId} from './utils/normalizeWorkflowId'
import AliasValidator from './commandExecutor/commands/aliases/AliasValidator'

const IntegrationController = {
  authorization: async (ctx, next) => {
    const {userId} = ctx.state

    if (!userId) {
      ctx.throw(401, 'Authentication needed.')
    }

    await next()
  },
  getAll: async ctx => {
    const {userId} = ctx.state
    const workflowId = normalizeWorkflowId(ctx.query.workflowId)

    const integration = await IntegrationFacade.findMergedDecrypted(userId, workflowId)
    if (!integration) {
      ctx.throw(404, 'Integration not found')
    }

    ctx.body = integration
  },
  getService: async ctx => {
    const {userId} = ctx.state
    const {service} = ctx.params
    const workflowId = normalizeWorkflowId(ctx.query.workflowId)

    const integration = await IntegrationFacade.findMergedDecrypted(userId, workflowId)
    if (!integration || !integration[service]) {
      ctx.throw(404, 'Integration for the called application was not found')
    }

    ctx.body = {[service]: integration[service]}
  },
  updateService: async ctx => {
    const {userId} = ctx.state
    const {service} = ctx.params
    const workflowId = normalizeWorkflowId(ctx.query.workflowId)
    const integration = await ctx.request.json()

    if (!integration) {
      ctx.throw(400, 'Something is wrong with the provided data')
    }

    if (service === 'mcp' || service === 'rpc') {
      try {
        const existingIntegration = await IntegrationRepository.findWithFallback(userId, workflowId)
        const mcpAliases = service === 'mcp' ? integration : existingIntegration?.mcp || []
        const rpcAliases = service === 'rpc' ? integration : existingIntegration?.rpc || []
        AliasValidator.validateIntegrationArrays(mcpAliases, rpcAliases)
      } catch (error) {
        if (error.name === 'AliasValidationError') {
          ctx.throw(400, error.message)
        }
        throw error
      }
    }

    let updateVectors = false
    let vectors = await LLMVector.findOne({userId, name: null})

    if (!vectors) {
      vectors = new LLMVector({
        userId,
        name: null,
        store: {
          [service]: {},
        },
      })
      updateVectors = true
    } else {
      if (!vectors.store.has(service)) {
        vectors.store.set(service, {})
        updateVectors = true
      }
    }

    if (updateVectors) {
      await vectors.save()
    }

    const encryptionContext = {
      userId,
      workflowId,
    }

    const encryptedData = encryptFields({[service]: integration}, INTEGRATION_ENCRYPTION_CONFIG, encryptionContext)
    const update = {$set: {userId, workflowId, ...encryptedData}}
    const options = {upsert: true}
    await Integration.updateOne({userId, workflowId}, update, options)

    ctx.body = {vectors}
  },
  scrapeV2: async ctx => {
    const {hrefs, snippets, maxChunks, chunkSize} = await ctx.request.json()

    if (!chunkSize) {
      ctx.throw(404, 'Chunk size is required')
    }

    if (!hrefs?.length) {
      ctx.body = {result: []}
      return
    }

    try {
      const chunker = PhraseChunkBuilderV2(snippets, chunkSize, maxChunks)

      for (const href of hrefs) {
        if (chunker.isFull()) {
          break
        }

        try {
          const str = await fetchAsString(href)
          if (chunker.appendChunks(str, href)) {
            break
          }
        } catch (e) {
          console.error('Unable to scrape:', e.message)
        }
      }

      ctx.body = {result: chunker.chunks()}
    } catch (e) {
      console.error('Unable to scrape:', e.message)
    }
  },
  translate: async ctx => {
    const {text, to} = await ctx.request.json()

    if (!text) {
      ctx.throw(500, 'text is required')
    }

    try {
      ctx.body = {
        result: (await googleTranslate(text, {to})).text,
      }
    } catch (e) {
      console.error('Unable to translate:', e.message)
    }
  },
  search: async ctx => {
    ctx.set('x-forwarded-host', '')
    try {
      const apiUrl = `https://serpapi.com/search?api_key=${SERP_API_KEY}&${querystring.stringify(ctx.request.query)}`

      const response = await fetch(apiUrl)

      if (!response.ok) {
        ctx.throw(response.status, response.statusText)
      }

      const data = await response.json()

      ctx.body = data
    } catch (error) {
      ctx.throw(500, error.message)
    }
  },
  downloadImage: async ctx => {
    const {imageUrl} = await ctx.request.json()

    try {
      const response = await fetch(imageUrl)

      if (!response.ok) {
        throw new Error('Failed to download image')
      }

      const imageBuffer = await response.buffer()

      const compressedImageBuffer = await sharp(imageBuffer).jpeg({quality: 50}).toBuffer()

      ctx.type = response.headers.get('content-type')
      ctx.body = compressedImageBuffer
    } catch (e) {
      ctx.throw(500, e.message)
    }
  },
  setLanguage: async ctx => {
    try {
      const {userId} = ctx.state
      const {lang: newLang, workflowId} = await ctx.request.json()
      const normalizedWorkflowId = normalizeWorkflowId(workflowId)

      if (!newLang) {
        ctx.throw('Lang not specified')
      }

      const integration = await IntegrationRepository.findWithFallback(userId, normalizedWorkflowId)

      if (!integration || integration.lang !== newLang) {
        if (newLang === USER_DEFAULT_LANGUAGE || validateLang(newLang)) {
          const update = {$set: {userId, workflowId: normalizedWorkflowId, lang: newLang}}
          const options = {upsert: true}
          await Integration.updateOne({userId, workflowId: normalizedWorkflowId}, update, options)
        }
      }

      ctx.body = {lang: newLang}
    } catch (e) {
      ctx.throw(500, e.message)
    }
  },
  getLanguages: async ctx => {
    ctx.body = LANGUAGES
  },
  setModel: async ctx => {
    try {
      const {userId} = ctx.state
      const {model: newModel, workflowId} = await ctx.request.json()
      const normalizedWorkflowId = normalizeWorkflowId(workflowId)

      if (!newModel) {
        ctx.throw('Model not specified')
      }

      const integration = await IntegrationRepository.findWithFallback(userId, normalizedWorkflowId)

      if (!integration || integration.model !== newModel) {
        if (newModel === USER_DEFAULT_MODEL || MODELS.includes(newModel)) {
          const update = {$set: {userId, workflowId: normalizedWorkflowId, model: newModel}}
          const options = {upsert: true}
          await Integration.updateOne({userId, workflowId: normalizedWorkflowId}, update, options)
        }
      }

      ctx.body = {model: newModel}
    } catch (e) {
      ctx.throw(500, e.message)
    }
  },
  scrapeFiles: async ctx => {
    const {urls, ...params} = await ctx.request.json()

    if (!urls?.length) {
      ctx.body = []
      return
    }

    try {
      ctx.body = await scrapeFiles(urls, params)
    } catch (e) {
      console.error('Unable to scrape:', e.message)
    }
  },
  deleteIntegration: async ctx => {
    const {userId} = ctx.state
    const workflowId = normalizeWorkflowId(ctx.query.workflowId)

    await Integration.deleteOne({userId, workflowId})

    ctx.status = 204
    ctx.body = null
  },
}

export default IntegrationController

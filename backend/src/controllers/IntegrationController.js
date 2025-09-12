import googleTranslate from '@iamtraction/google-translate'
import Integration from '../models/Integration'
import {SERP_API_KEY} from '../constants'
import querystring from 'querystring'
import fetch from 'node-fetch'
import sharp from 'sharp'
import {validateLang} from './utils/validateLang'
import {LANGUAGES, MODELS, USER_DEFAULT_LANGUAGE, USER_DEFAULT_MODEL} from '../shared/config/constants'
import {PhraseChunkBuilderV2, scrapeFiles, fetchAsString} from './utils/scrape'
import LLMVector from '../models/LLMVector'

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

    const integration = await Integration.findOne({userId})
    if (!integration) {
      ctx.throw(404, 'Integration not found')
    }
    ctx.body = integration
  },
  getService: async ctx => {
    const {userId} = ctx.state
    const {service} = ctx.params

    const integration = await Integration.findOne({userId}, {[service]: 1, _id: 0})
    if (!integration) {
      ctx.throw(404, 'Integration for the called application was not found')
    }
    ctx.body = integration
  },
  updateService: async ctx => {
    const {userId} = ctx.state
    const {service} = ctx.params
    const integration = await ctx.request.json()

    if (!integration) {
      ctx.throw(400, 'Something is wrong with the provided data')
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

    const update = {$set: {userId, [service]: integration}}
    const options = {upsert: true}
    await Integration.updateOne({userId}, update, options)

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
      const {lang: newLang} = await ctx.request.json()

      if (!newLang) {
        ctx.throw('Lang not specified')
      }

      const integration = await Integration.findOne({userId})

      if (integration.lang !== newLang && (newLang === USER_DEFAULT_LANGUAGE || validateLang(newLang))) {
        const update = {$set: {userId, lang: newLang}}
        const options = {upsert: true}
        await Integration.updateOne({userId}, update, options)
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
      const {model: newModel} = await ctx.request.json()

      if (!newModel) {
        ctx.throw('Model not specified')
      }

      const integration = await Integration.findOne({userId})

      if (integration.model !== newModel && (newModel === USER_DEFAULT_MODEL || MODELS.includes(newModel))) {
        const update = {$set: {userId, model: newModel}}
        const options = {upsert: true}
        await Integration.updateOne({userId}, update, options)
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
}

export default IntegrationController

import {container} from '../../services/container'
import {DEFAULT_OPENAI_MODEL_NAME, OPENAI_API_KEY_EMPTY} from '../../constants'
import debug from 'debug'

const log = debug('delta5:Integration:OpenAI')

const OpenAIController = {
  chatCompletions: async ctx => {
    const {messages, model: userModelName, ...openAIParams} = await ctx.request.json('infinity')

    try {
      const openaiService = container.get('openaiService')
      const userApiKey = ctx.headers.authorization.split(' ')[1]
      const modelName = userModelName || DEFAULT_OPENAI_MODEL_NAME

      if (!userApiKey || userApiKey === OPENAI_API_KEY_EMPTY) {
        if (!openaiService.checkApiKey()) {
          ctx.throw(401, 'OpenAI api key not found')
        }
      }

      if (!modelName) {
        ctx.throw(400, 'Model name not specified')
      }

      if (!messages || messages.length === 0 || !messages[0].content) {
        ctx.throw(400, 'Message not specified')
      }

      log('Request to OpenAI', {messages, modelName: userModelName})

      const data = await openaiService.chatCompletion(messages, modelName, openAIParams)

      log('Response from OpenAI', {messages: data.choices.map(n => n.message)})

      ctx.body = data
    } catch (error) {
      const statusCode = error.response ? error.response.status : 500
      ctx.throw(statusCode, error.message)
    }
  },
  checkOpenaiApiKey: ctx => {
    const openaiService = container.get('openaiService')
    ctx.body = {success: openaiService.checkApiKey()}
  },
  embeddings: async ctx => {
    const {input, model: userModelName} = await ctx.request.json('infinity')

    try {
      const openaiService = container.get('openaiService')
      const userApiKey = ctx.headers.authorization.split(' ')[1]
      const modelName = userModelName || DEFAULT_OPENAI_MODEL_NAME

      if (!userApiKey || userApiKey === OPENAI_API_KEY_EMPTY) {
        if (!openaiService.checkApiKey()) {
          ctx.throw(401, 'OpenAI api key not found')
        }
      }

      if (!modelName) {
        ctx.throw(400, 'Model name not specified')
      }

      if (!input) {
        ctx.throw(400, 'Input not specified')
      }

      const response = await openaiService.embeddings(input, modelName)

      ctx.body = response
    } catch (error) {
      const statusCode = error.response ? error.response.status : 500
      ctx.throw(statusCode, error.message)
    }
  },
  dalleGenerations: async ctx => {
    const {n, prompt, response_format, size} = await ctx.request.json()
    const openaiService = container.get('openaiService')
    const userApiKey = ctx.headers.authorization.split(' ')[1]

    if (!userApiKey || userApiKey === OPENAI_API_KEY_EMPTY) {
      if (!openaiService.checkApiKey()) {
        ctx.throw(401, 'OpenAI api key not found')
      }
    }

    if (!prompt) {
      ctx.throw(400, 'Input not specified')
    }

    try {
      const response = await openaiService.dalleGenerations(prompt, n, size, response_format)

      ctx.body = response
    } catch (error) {
      const statusCode = error.response ? error.response.status : 500
      ctx.throw(statusCode, error.message)
    }
  },
}

export default OpenAIController

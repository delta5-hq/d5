import {OpenAIEmbeddings} from 'langchain/embeddings/openai'
import {Configuration, OpenAIApi, OpenAIApi as OpenAIClient} from 'openai'
import {DEFAULT_OPENAI_MODEL_NAME, OPENAI_API_KEY, OPENAI_API_KEY_EMPTY} from '../../constants'
import debug from 'debug'

const log = debug('delta5:Integration:OpenAI')

const OpenAIController = {
  chatCompletions: async ctx => {
    const {messages, model: userModelName, ...openAIParams} = await ctx.request.json('infinity')

    try {
      const userApiKey = ctx.headers.authorization.split(' ')[1]
      const openAIApiKey = userApiKey && userApiKey !== OPENAI_API_KEY_EMPTY ? userApiKey : OPENAI_API_KEY
      const modelName = userModelName || DEFAULT_OPENAI_MODEL_NAME

      if (!openAIApiKey) {
        ctx.throw(401, 'OpenAI api key not found')
      }

      if (!modelName) {
        ctx.throw(400, 'Model name not specified')
      }

      if (!messages || messages.length === 0 || !messages[0].content) {
        ctx.throw(400, 'Message not specified')
      }

      log('Request to OpenAI', {messages, modelName: userModelName})

      const {data} = await new OpenAIApi(
        new Configuration({
          apiKey: openAIApiKey,
        }),
      ).createChatCompletion({
        model: modelName,
        messages,
        ...openAIParams,
      })

      log('Response from OpenAI', {messages: data.choices.map(n => n.message)})

      ctx.body = data
    } catch (error) {
      const statusCode = error.response ? error.response.status : 500
      ctx.throw(statusCode, error.message)
    }
  },
  checkOpenaiApiKey: ctx => {
    ctx.body = {success: !!OPENAI_API_KEY}
  },
  embeddings: async ctx => {
    const {input, model: userModelName} = await ctx.request.json('infinity')

    try {
      const userApiKey = ctx.headers.authorization.split(' ')[1]
      const openAIApiKey = userApiKey && userApiKey !== OPENAI_API_KEY_EMPTY ? userApiKey : OPENAI_API_KEY
      const modelName = userModelName || DEFAULT_OPENAI_MODEL_NAME

      if (!openAIApiKey) {
        ctx.throw(401, 'OpenAI api key not found')
      }

      if (!modelName) {
        ctx.throw(400, 'Model name not specified')
      }

      if (!input) {
        ctx.throw(400, 'Input not specified')
      }

      const embeddings = new OpenAIEmbeddings({
        openAIApiKey: openAIApiKey,
      })

      const embeddingResults = await embeddings.embedDocuments(!Array.isArray(input) ? [input] : input)

      const response = {
        data: embeddingResults.map((embedding, index) => ({
          index,
          object: 'embedding',
          embedding,
        })),
      }

      ctx.body = response
    } catch (error) {
      const statusCode = error.response ? error.response.status : 500
      ctx.throw(statusCode, error.message)
    }
  },
  dalleGenerations: async ctx => {
    const {n, prompt, response_format, size} = await ctx.request.json()
    const userApiKey = ctx.headers.authorization.split(' ')[1]
    const openAIApiKey = userApiKey && userApiKey !== OPENAI_API_KEY_EMPTY ? userApiKey : OPENAI_API_KEY

    if (!openAIApiKey) {
      ctx.throw(401, 'OpenAI api key not found')
    }

    if (!prompt) {
      ctx.throw(400, 'Input not specified')
    }

    try {
      const clientConfig = {
        apiKey: openAIApiKey,
      }
      const client = new OpenAIClient(new Configuration(clientConfig))

      const response = await client.createImage({
        prompt,
        n,
        size,
        response_format,
      })

      if (response.status !== 200) {
        ctx.throw(response.status, response.statusText)
      }
      ctx.body = response.data
    } catch (error) {
      const statusCode = error.response ? error.response.status : 500
      ctx.throw(statusCode, error.message)
    }
  },
}

export default OpenAIController

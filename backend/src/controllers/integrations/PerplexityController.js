import debug from 'debug'
import {container} from '../../services/container'

debug('delta5:Integration:Perplexity')

const perplexityService = container.get('perplexityService')

export const PerplexityController = {
  completions: async ctx => {
    try {
      const {messages, maxTokens, ...otherParams} = await ctx.request.json()

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        ctx.throw(400, 'Messages are required')
      }

      const authHeader = ctx.headers.authorization
      const apiKey = authHeader?.split(' ')[1]
      if (!apiKey) {
        ctx.throw(401, 'Perplexity API key not provided')
      }

      /* E2E_MODE uses noop service, production uses real API */
      const data = await perplexityService.completions({
        messages,
        maxTokens: maxTokens || 150,
        ...otherParams,
      })

      ctx.body = data
    } catch (error) {
      const statusCode = error.response?.status || 500
      ctx.throw(statusCode, error.message)
    }
  },
}

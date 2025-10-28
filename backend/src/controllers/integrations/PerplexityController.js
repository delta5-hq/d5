import fetch from 'node-fetch'
import debug from 'debug'

const log = debug('delta5:Integration:Perplexity')

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

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          messages,
          maxTokens: maxTokens || 150,
          ...otherParams,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        log('Perplexity API error', {status: response.status, text: errorText})
        ctx.throw(response.status, errorText)
      }

      const data = await response.json()
      ctx.body = data
    } catch (error) {
      const statusCode = error.response?.status || 500
      ctx.throw(statusCode, error.message)
    }
  },
}

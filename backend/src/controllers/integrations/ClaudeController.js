import {container} from '../../services/container'

const claudeService = container.get('claudeService')

const ClaudeController = {
  sendMessages: async ctx => {
    try {
      const {messages, model, ...params} = await ctx.request.json('infinity')
      const apiKey = ctx.headers['x-api-key']

      if (!apiKey) {
        ctx.throw(400, 'Claude API key not found')
      }

      if (!model) {
        ctx.throw(400, 'Model name not specified')
      }

      if (!messages || messages.length === 0 || !messages[0]?.content) {
        ctx.throw(400, 'Messages not specified')
      }

      if (!params.max_tokens) {
        ctx.throw(400, 'max_tokens not specified')
      }

      const result = await claudeService.sendMessages({
        model,
        messages,
        ...params,
      })

      ctx.body = result
    } catch (e) {
      ctx.throw(e.status || 500, e.message || 'Internal Server Error')
    }
  },
}

export default ClaudeController

import {ClaudeService} from './claude/ClaudeService'

const ClaudeController = {
  sendMessages: async ctx => {
    try {
      const {userId} = ctx.state
      const {messages, model, ...params} = await ctx.request.json('infinity')
      const apiKey = ctx.headers['x-api-key']

      const result = await ClaudeService.sendMessages({
        apiKey,
        model,
        messages,
        userId,
        ...params,
      })

      ctx.body = result
    } catch (e) {
      ctx.throw(e.status || 500, e.message || 'Internal Server Error')
    }
  },
}

export default ClaudeController

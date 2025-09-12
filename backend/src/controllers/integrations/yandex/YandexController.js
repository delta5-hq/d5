import {DynamicTimeoutManager} from './DynamicTimeoutManager'
import YandexService, {YandexOperationTimeoutError} from './YandexService'

const YandexController = {
  yandexCompletion: async ctx => {
    const body = await ctx.request.json('infinity')
    const retry = Number(ctx.query.retry || 0)
    const apiKey = ctx.headers.authorization.split(' ')[1]

    const {messages} = body
    if (!messages?.length && !messages[0]?.text) {
      ctx.throw(400, 'Input not specified')
    }

    try {
      let result

      if (!retry) {
        const operation = await YandexService.completions({...body, apiKey})
        result = await YandexService.getOperationResult(operation, apiKey)
      } else {
        let attempts = retry + 1
        const timeoutManager = new DynamicTimeoutManager()

        while (attempts && !result) {
          attempts -= 1
          const operation = await YandexService.completions({...body, apiKey})

          const startTime = Date.now()

          try {
            result = await YandexService.getOperationResult(
              operation,
              apiKey,
              timeoutManager.calculateTimeout(attempts),
            )
          } catch (e) {
            if (!(e instanceof YandexOperationTimeoutError) || !attempts) {
              throw e
            }
          } finally {
            const duration = (Date.now() - startTime) / 1000
            timeoutManager.updateDuration(duration)
          }
        }
      }

      if (!result) {
        throw Error('Can not get response from yandexgpt')
      }

      ctx.body = result
    } catch (e) {
      if (e instanceof YandexOperationTimeoutError) {
        ctx.throw(400, e.message)
      }
      ctx.throw(e.status || 500, e.message || 'Internal Server Error')
    }
  },
  embeddings: async ctx => {
    try {
      const {modelUri, text} = await ctx.request.json('infinity')
      const apiKey = ctx.headers.authorization.split(' ')[1]

      if (!text || !modelUri) {
        ctx.throw(400, 'Input not specified')
      }

      if (!apiKey) {
        ctx.throw(401, 'Unauthorized')
      }

      const result = await YandexService.embeddings({modelUri, text, apiKey})

      ctx.body = result
    } catch (e) {
      ctx.throw(e.status || 500, e.message || 'Internal Server Error')
    }
  },
}

export default YandexController

import debug from 'debug'
import {HttpError} from '../../../shared/utils/HttpError'
import {container} from '../../../services/container'

const log = debug('delta5:Integration:ClaudeAPI')
const claudeService = container.get('claudeService')

export const ClaudeService = {
  sendMessages: async ({apiKey, model, messages, userId, ...params}) => {
    if (!apiKey) {
      throw new HttpError('Claude API key not found', 400)
    }

    if (!model) {
      throw new HttpError('Model name not specified', 400)
    }

    if (!messages || messages.length === 0 || !messages[0].content) {
      throw new HttpError('Messages not specified', 400)
    }

    if (!params.max_tokens) {
      throw new HttpError('max_tokens not specified', 400)
    }

    log('Request to Claude API', {userId, messages, model})

    /* E2E_MODE uses noop service, production uses real API */
    const result = await claudeService.sendMessages({
      model,
      messages,
      ...params,
    })

    log('Response from Claude API', {userId, messages, model})
    return result
  },
}

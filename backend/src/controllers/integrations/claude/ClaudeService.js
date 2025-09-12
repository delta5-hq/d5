import fetch from 'node-fetch'
import debug from 'debug'
import {ANTHROPIC_VERSION, CLAUDE_API_URL} from '../../../shared/config/constants'
import {HttpError} from '../../../shared/utils/HttpError'

const log = debug('delta5:Integration:ClaudeAPI')

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

    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      body: JSON.stringify({
        model,
        messages,
        ...params,
      }),
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
    })

    let result = {}
    try {
      result = await response.json()
    } catch (jsonError) {
      log('Error parsing JSON response:', jsonError)
    }

    if (!response.ok) {
      const errorMessage = result.error?.message || 'Unknown error from Claude API'
      throw new HttpError(errorMessage, response.status)
    }

    log('Response from Claude API', {userId, messages, model})
    return result
  },
}

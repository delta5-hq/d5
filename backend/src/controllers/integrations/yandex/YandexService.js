import fetch from 'node-fetch'
import {delay} from './../../utils/delay'
import {DynamicTimeoutManager} from './DynamicTimeoutManager'
import {HttpError} from '../../../shared/utils/HttpError'

export class YandexOperationTimeoutError extends Error {
  constructor(message) {
    super(message)

    this.name = 'YandexGPT Timeout Error'
  }
}

class YandexService {
  completions = async params => {
    const {messages, modelUri, apiKey, completionOptions} = params
    const {stream, temperature, maxTokens} = completionOptions || {}

    const body = {
      modelUri,
      completionOptions: {
        stream: stream ?? false,
        temperature: temperature ?? 0.2,
        maxTokens: maxTokens ?? 2000,
      },
      messages,
    }
    const headers = {
      Authorization: `Api-Key ${apiKey}`,
    }

    const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completionAsync', {
      method: 'POST',
      body: JSON.stringify(body),
      headers,
    })

    const operation = await response.json()

    if (!response.ok) {
      const {message = response.statusText} = operation
      throw new HttpError(message, response.status)
    }

    return operation
  }
  getOperationResult = async (operation, apiKey, maxAttempts = 60) => {
    let attempts = 0
    let operationStatus = operation

    const headers = {
      Authorization: `Api-Key ${apiKey}`,
    }

    while (!operationStatus.done && attempts < maxAttempts) {
      const statusResponse = await fetch(`https://operation.api.cloud.yandex.net/operations/${operation.id}`, {
        method: 'GET',
        headers,
      })

      if (statusResponse.status !== 200) {
        const {statusText, status} = statusResponse
        throw new HttpError(statusText, status)
      }

      operationStatus = await statusResponse.json()
      await delay(1000)
      attempts += 1
    }

    if (attempts === maxAttempts) {
      throw new YandexOperationTimeoutError('YandexGPT request timeout')
    }

    if (operationStatus.error) {
      throw new Error(operationStatus.error.message)
    }

    return operationStatus.response
  }
  embeddings = async ({modelUri, text, apiKey}) => {
    const body = {
      modelUri,
      text: text,
    }

    const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/textEmbedding', {
      method: 'POST',
      headers: {
        Authorization: `Api-Key ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    const result = await response.json()

    if (!response.ok) {
      const {message = response.statusText} = result
      throw new HttpError(message, response.status)
    }

    return result
  }
  completionWithRetry = async (params, retries = 3) => {
    const {apiKey} = params

    let attempts = retries + 1
    const timeoutManager = new DynamicTimeoutManager()

    let result

    while (attempts && !result) {
      attempts -= 1
      const operation = await this.completions(params)

      const startTime = Date.now()

      try {
        result = await this.getOperationResult(operation, apiKey, timeoutManager.calculateTimeout(attempts))
      } catch (e) {
        if (!(e instanceof YandexOperationTimeoutError) || !attempts) {
          throw e
        }
      } finally {
        const duration = (Date.now() - startTime) / 1000
        timeoutManager.updateDuration(duration)
      }
    }

    return result
  }
}

export default new YandexService()

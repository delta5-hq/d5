import {container} from '../../../services/container'

const yandexService = container.get('yandexService')

export class YandexOperationTimeoutError extends Error {
  constructor(message) {
    super(message)

    this.name = 'YandexGPT Timeout Error'
  }
}

class YandexService {
  completions = async params => {
    const {messages, modelUri, completionOptions} = params
    const {temperature, maxTokens} = completionOptions || {}

    const body = {
      messages,
      model: modelUri,
      temperature,
      maxTokens,
    }
    const response = await yandexService.completion(body)

    return {
      id: 'operation-id',
      done: true,
      response,
    }
  }

  getOperationResult = async operation => {
    return operation.response
  }

  embeddings = async ({modelUri, text}) => {
    const result = await yandexService.embeddings({modelUri, text})
    return result
  }

  completionWithRetry = async (params, retries = 3) => {
    let attempts = retries + 1
    let result

    while (attempts && !result) {
      attempts -= 1
      const operation = await this.completions(params)

      try {
        result = await this.getOperationResult(operation)
      } catch (e) {
        if (!(e instanceof YandexOperationTimeoutError) || !attempts) {
          throw e
        }
      }
    }

    return result
  }
}

export default new YandexService()

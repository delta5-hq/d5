import {container} from '../../../services/container'

const yandexService = container.get('yandexService')

export class YandexOperationTimeoutError extends Error {
  constructor(message) {
    super(message)
    this.name = 'YandexGPT Timeout Error'
  }
}

const buildCompletionBody = ({modelUri, messages, completionOptions}) => ({
  modelUri,
  messages,
  completionOptions: {
    stream: false,
    temperature: completionOptions?.temperature,
    maxTokens: completionOptions?.maxTokens,
  },
})

export const extractCompletionText = response => response?.result?.alternatives?.[0]?.message?.text

class YandexService {
  completions = async ({modelUri, messages, completionOptions, apiKey, folderId}) => {
    const body = buildCompletionBody({modelUri, messages, completionOptions})
    const response = await yandexService.completion({...body, apiKey, folderId})
    return {id: 'operation-id', done: true, response}
  }

  getOperationResult = async operation => operation.response

  embeddings = async ({modelUri, text, apiKey, folderId}) =>
    yandexService.embeddings({modelUri, text, apiKey, folderId})

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

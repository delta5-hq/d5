import { YANDEX_DEFAULT_MODEL, YANDEX_GPT_COMPLETION_PATH, YANDEX_GPT_EMBEDDINGS_PATH } from '@shared/config'
import { AIMessage, type BaseMessage } from '@langchain/core/messages'
import { BaseLLM, type BaseLLMParams } from '@langchain/core/language_models/llms'
import type { ChatGeneration, ChatResult, LLMResult } from '@langchain/core/outputs'
import { Embeddings, type EmbeddingsParams } from '@langchain/core/embeddings'
import { HttpError } from '../error'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager'
import type { Yandex } from '@shared/base-types'

interface ParsedMessage {
  role: string
  text: string
}

export function parseChatHistory(history: BaseMessage[]): ParsedMessage[] {
  const chatHistory: ParsedMessage[] = []

  for (const message of history) {
    if (typeof message.content !== 'string') {
      throw new Error('ChatYandexGPT does not support non-string message content.')
    }
    if ('content' in message) {
      if (message._getType() === 'human') {
        chatHistory.push({ role: 'user', text: message.content })
      } else if (message._getType() === 'ai') {
        chatHistory.push({ role: 'assistant', text: message.content })
      } else if (message._getType() === 'system') {
        chatHistory.push({ role: 'system', text: message.content })
      }
    }
  }

  return chatHistory
}

const apiUrl = YANDEX_GPT_COMPLETION_PATH

export interface YandexGPTInputs extends BaseLLMParams {
  /**
   * What sampling temperature to use.
   * Should be a double number between 0 (inclusive) and 1 (inclusive).
   */
  temperature?: number

  /**
   * Maximum limit on the total number of tokens
   * used for both the input prompt and the generated response.
   */
  maxTokens?: number

  /** Model name to use. */
  model?: string

  /** Model version to use. */
  modelVersion?: string

  /** Model URI to use. */
  modelURI?: string

  /**
   * Yandex Cloud Folder ID
   */
  folderID?: string

  /**
   * Yandex Cloud Api Key for service account
   * with the `ai.languageModels.user` role.
   */
  apiKey?: string

  /**
   * Yandex Cloud IAM token for service or user account
   * with the `ai.languageModels.user` role.
   */
  iamToken?: string

  signal?: AbortSignal
}

export class YandexGPT extends BaseLLM implements YandexGPTInputs {
  lc_serializable = true

  static lc_name() {
    return 'YandexGPT'
  }

  get lc_secrets(): Record<string, string> | undefined {
    return {
      apiKey: 'YC_API_KEY',
      iamToken: 'YC_IAM_TOKEN',
      folderID: 'YC_FOLDER_ID',
    }
  }

  temperature = 0.6

  maxTokens = 1700

  model = 'yandexgpt'

  modelVersion = 'latest'

  modelURI?: string

  apiKey: string

  iamToken?: string

  folderID?: string

  signal?: AbortSignal

  completionRetryCount = 0

  constructor(fields: YandexGPTInputs) {
    super(fields)
    const apiKey = fields?.apiKey
    if (!apiKey) {
      throw new Error('Api Key is required')
    }

    const iamToken = fields?.iamToken

    const folderID = fields?.folderID
    const modelURI = fields?.modelURI
    if (!folderID && !modelURI) {
      throw new Error('Folder ID is required')
    }

    if (!apiKey && !iamToken) {
      throw new Error(
        'Please set the YC_API_KEY or YC_IAM_TOKEN environment variable or pass it to the constructor as the apiKey or iamToken field.',
      )
    }

    this.modelURI = modelURI
    this.apiKey = apiKey
    this.iamToken = iamToken
    this.folderID = folderID
    this.maxTokens = fields?.maxTokens ?? this.maxTokens
    this.temperature = fields?.temperature ?? this.temperature
    this.model = fields?.model ?? this.model
    this.modelVersion = fields?.modelVersion ?? this.modelVersion
    this.signal = fields?.signal

    if (!this.modelURI && !folderID) {
      throw new Error(
        'Please set the YC_FOLDER_ID environment variable or pass Yandex GPT model URI to the constructor as the modelURI field.',
      )
    }

    if (!this.modelURI) {
      this.modelURI = `gpt://${this.folderID}/${this.model}/${this.modelVersion}`
    }
  }

  _llmType() {
    return 'yandexgpt'
  }

  /** @ignore */
  async _call(prompt: string, options: this['ParsedCallOptions']): Promise<string> {
    return this.caller.callWithOptions({ signal: options.signal }, async () => {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: '',
        'x-folder-id': '',
      }
      if (this.apiKey !== undefined) {
        headers.Authorization = `Api-Key ${this.apiKey}`
      } else {
        headers.Authorization = `Bearer ${this.iamToken}`
        if (this.folderID !== undefined) {
          headers['x-folder-id'] = this.folderID
        }
      }
      const bodyData = {
        modelUri: this.modelURI,
        completionOptions: {
          temperature: this.temperature,
          maxTokens: this.maxTokens,
        },

        messages: [{ role: 'user', text: prompt }],
      }

      const response = await fetch(`${apiUrl}?retry=${this.completionRetryCount}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyData),
        signal: this.signal,
      })

      const responseData = await response.json()

      if (!response.ok) {
        this.completionRetryCount += 1
        throw new HttpError(responseData.message || response.statusText, response)
      } else {
        this.completionRetryCount = 0
      }

      return responseData.result.alternatives[0].message.text.replaceAll('**', '').trim()
    })
  }

  async _generate(prompts: string[], options: this['ParsedCallOptions']): Promise<LLMResult> {
    return this.caller.callWithOptions({ signal: options.signal }, async () => {
      const alternatives = []
      const tokenUsage = { completionTokens: 0, totalTokens: 0, inputTextTokens: 0 }

      const headers = {
        'Content-Type': 'application/json',
        Authorization: '',
        'x-folder-id': '',
      }
      if (this.apiKey !== undefined) {
        headers.Authorization = `Api-Key ${this.apiKey}`
      } else {
        headers.Authorization = `Bearer ${this.iamToken}`
        if (this.folderID !== undefined) {
          headers['x-folder-id'] = this.folderID
        }
      }

      for (let i = 0; i < prompts.length; i += 1) {
        const bodyData = {
          modelUri: this.modelURI,
          completionOptions: {
            temperature: this.temperature,
            maxTokens: this.maxTokens,
          },

          messages: [{ role: 'user', text: prompts[i] }],
        }

        const response = await fetch(`${apiUrl}?retry=${this.completionRetryCount}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(bodyData),
          signal: this.signal,
        })

        const responseData = await response.json()

        if (!response.ok) {
          this.completionRetryCount += 1
          throw new HttpError(responseData.message || response.statusText, response)
        } else {
          this.completionRetryCount = 0
        }

        if (responseData?.alternatives) {
          alternatives.push(...responseData.alternatives)
        }

        const { completionTokens, totalTokens, inputTextTokens } = responseData.usage ?? {}
        if (completionTokens) {
          tokenUsage.completionTokens = (tokenUsage.completionTokens ?? 0) + completionTokens
        }
        if (inputTextTokens) {
          tokenUsage.inputTextTokens = (tokenUsage.inputTextTokens ?? 0) + inputTextTokens
        }
        if (totalTokens) {
          tokenUsage.totalTokens = (tokenUsage.totalTokens ?? 0) + totalTokens
        }
      }

      const generations = alternatives.map(a => {
        let { text } = a.message

        if (options.stop) {
          let minIndex = text.length

          for (const word of options.stop) {
            const index = text.indexOf(word)
            if (index !== -1 && index < minIndex) {
              minIndex = index
            }
          }
          text = text.substring(0, minIndex)
        }

        return { text: text.replaceAll('**', '').trim() }
      })

      return {
        generations: [generations],
        llmOutput: { tokenUsage },
      }
    })
  }
}

const embeddingsApiUrl = YANDEX_GPT_EMBEDDINGS_PATH

export interface YandexGPTEmbeddingsParams extends EmbeddingsParams {
  /** Model name to use. */
  model?: string

  /** Model version to use. */
  modelVersion?: string

  /** Model version to use. */

  /** Model URI to use. */
  modelURI?: string

  /** Yandex Cloud Folder ID. */
  folderID?: string

  /**
   * Yandex Cloud Api Key for service account
   * with the `ai.languageModels.user` role.
   */
  apiKey?: string

  /**
   * Yandex Cloud IAM token for service or user account
   * with the `ai.languageModels.user` role.
   */
  iamToken?: string
}

const MAX_RETRIES = 3
const NUMBER_OF_WORKERS = 20
const MAX_CYCLE_COUNT = 100

interface EmbeddingChunk {
  chunk: string
  retriesLeft: number
}

/**
 * Class for generating embeddings using the YandexGPT Foundation models API. Extends the
 * Embeddings class and implements YandexGPTEmbeddings
 */
export class YandexGPTEmbeddings extends Embeddings {
  model = 'text-search-query'

  modelVersion = 'latest'

  _modelURI?: string

  apiKey?: string

  iamToken?: string

  folderID?: string

  constructor(fields?: YandexGPTEmbeddingsParams) {
    super(fields ?? {})

    const apiKey = fields?.apiKey

    const iamToken = fields?.iamToken

    const folderID = fields?.folderID

    if (apiKey === undefined && iamToken === undefined) {
      throw new Error(
        'Please set the YC_API_KEY or YC_IAM_TOKEN environment variable or pass it to the constructor as the apiKey or iamToken field.',
      )
    }

    this._modelURI = fields?.modelURI
    this.apiKey = apiKey
    this.iamToken = iamToken
    this.folderID = folderID
    this.model = fields?.model ?? this.model
    this.modelVersion = fields?.modelVersion ?? this.modelVersion

    if (this._modelURI === undefined && folderID === undefined) {
      throw new Error(
        'Please set the YC_FOLDER_ID environment variable or pass Yandex GPT model URI to the constructor as the modelURI field.',
      )
    }
  }

  get modelURI() {
    return this._modelURI ? this._modelURI : `emb://${this.folderID}/${this.model}/${this.modelVersion}`
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: 'YC_API_KEY',
      iamToken: 'YC_IAM_TOKEN',
      folderID: 'YC_FOLDER_ID',
    }
  }

  /**
   * Method to generate embeddings for an array of documents.
   * @param texts Array of documents to generate embeddings for.
   * @returns Promise that resolves to a 2D array of embeddings for each document.
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    this.model = 'text-search-doc'
    return this.embeddingWithRetry(texts)
  }

  /**
   * Method to generate an embedding for a single document. Calls the
   * embedDocuments method with the document as the input.
   * @param text Document to generate an embedding for.
   * @returns Promise that resolves to an embedding for the document.
   */
  async embedQuery(text: string): Promise<number[]> {
    this.model = 'text-search-query'
    const data = await this.embeddingWithRetry([text])
    return data[0]
  }

  private _buildHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: this.apiKey ? `Api-Key ${this.apiKey}` : `Bearer ${this.iamToken}`,
    }
    if (this.folderID) {
      headers['x-folder-id'] = this.folderID
    }

    return headers
  }

  private async _callEmbeddingAPI(init: RequestInit): Promise<number[]> {
    const response = await fetch(embeddingsApiUrl, { ...init })

    if (!response.ok) {
      const error = new Error('Yandex Embeddings API error')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(error as any).response = response
      throw error
    }

    const responseData = await response.json()

    return responseData.embedding
  }

  private async _embeddingWorker(
    chunksRemaining: EmbeddingChunk[],
    chunksLimitReached: string[],
    chunksInvalid: string[],
  ): Promise<number[][]> {
    let maxCycleCount = MAX_CYCLE_COUNT

    const embeddings: number[][] = []

    while (chunksRemaining.length) {
      maxCycleCount -= 1
      if (!maxCycleCount) {
        throw new Error('Max cycle count reached')
      }

      const { chunk, retriesLeft } = chunksRemaining.shift() as EmbeddingChunk

      if (!retriesLeft) {
        chunksLimitReached.push(chunk)

        continue
      }
      try {
        const embedding: number[] = await this._callEmbeddingAPI({
          method: 'POST',
          headers: this._buildHeaders(),
          body: JSON.stringify({
            modelUri: this.modelURI,
            text: chunk,
          }),
        })

        embeddings.push(embedding)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        if (error.response && error.response.status === 429) {
          chunksRemaining.push({ chunk, retriesLeft: retriesLeft - 1 })
        } else {
          chunksInvalid.push(chunk)
        }
      }
    }
    return embeddings
  }

  private async _runWorkers(texts: string[], numberOfWorkers: number, maxRetries: number) {
    const chunksRemaining: EmbeddingChunk[] = texts.map(chunk => ({ chunk, retriesLeft: maxRetries }))
    const chunksLimitReached: string[] = []
    const chunksInvalid: string[] = []

    const resolvedWorkers = await Promise.all(
      Array.from({ length: numberOfWorkers }, () =>
        this._embeddingWorker(chunksRemaining, chunksLimitReached, chunksInvalid),
      ),
    )

    return { chunksLimitReached, chunksInvalid, embeddings: resolvedWorkers.flatMap(val => val) }
  }

  /**
   * Private method to make a request to the YandexGPT API to generate
   * embeddings. Handles the retry logic and returns the embeddings from the API.
   * @param {string | Array<string>} texts Array of documents to generate embeddings for.
   * @returns {Promise<MistralAIEmbeddingsResult>} Promise that resolves to a 2D array of embeddings for each document.
   */
  private async embeddingWithRetry(texts: string[]): Promise<number[][]> {
    return this.caller.call(async () => {
      let chunksRemaining = texts.slice()
      let chunksInvalid: string[] = []

      let maxCycleCount = MAX_CYCLE_COUNT
      const embeddings: number[][] = []

      while (chunksRemaining.length) {
        maxCycleCount -= 1
        if (!maxCycleCount) {
          throw new Error('Max cycle count reached')
        }

        const numberOfWorkers = Math.max(
          1,
          Math.min(chunksRemaining.length, NUMBER_OF_WORKERS - (MAX_CYCLE_COUNT - maxCycleCount - 1)),
        )

        const res = await this._runWorkers(chunksRemaining, numberOfWorkers, MAX_RETRIES)
        chunksRemaining = res.chunksLimitReached.slice()
        chunksInvalid = [...chunksInvalid, ...res.chunksInvalid]

        embeddings.push(...res.embeddings)
      }
      return embeddings
    })
  }
}

/**
 * @example
 * ```typescript
 * const chat = new ChatYandexGPT({});
 * // The assistant is set to translate English to French.
 * const res = await chat.invoke([
 *   new SystemMessage(
 *     "You are a helpful assistant that translates English to French."
 *   ),
 *   new HumanMessage("I love programming."),
 * ]);
 * ```
 */
export class ChatYandexGPT extends BaseChatModel {
  temperature = 0.6

  maxTokens = 1700

  model = 'yandexgpt'

  modelVersion = 'latest'

  modelURI?: string

  apiKey: string

  iamToken?: string

  folderID?: string

  signal?: AbortSignal

  completionRetryCount = 0

  constructor(fields?: YandexGPTInputs) {
    super(fields ?? {})

    const apiKey = fields?.apiKey

    if (!apiKey) {
      throw new Error('Api Key is required')
    }

    const iamToken = fields?.iamToken
    const modelURI = fields?.modelURI
    const folderID = fields?.folderID
    if (!folderID && !modelURI) {
      throw new Error('Folder ID is required')
    }

    if (!apiKey && !iamToken) {
      throw new Error(
        'Please set the YC_API_KEY or YC_IAM_TOKEN environment variable or pass it to the constructor as the apiKey or iamToken field.',
      )
    }

    this.modelURI = modelURI
    this.apiKey = apiKey
    this.iamToken = iamToken
    this.folderID = folderID
    this.maxTokens = fields?.maxTokens ?? this.maxTokens
    this.temperature = fields?.temperature ?? this.temperature
    this.model = fields?.model ?? this.model
    this.modelVersion = fields?.modelVersion ?? this.modelVersion
    this.signal = fields?.signal

    if (this.modelURI === undefined && folderID === undefined) {
      throw new Error(
        'Please set the YC_FOLDER_ID environment variable or pass Yandex GPT model URI to the constructor as the modelURI field.',
      )
    }

    if (!this.modelURI) {
      this.modelURI = `gpt://${this.folderID}/${this.model}/${this.modelVersion}`
    }
  }

  _llmType() {
    return 'yandexgpt'
  }

  _combineLLMOutput?() {
    return {}
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: 'YC_API_KEY',
      iamToken: 'YC_IAM_TOKEN',
      folderID: 'YC_FOLDER_ID',
    }
  }

  /** @ignore */
  async _generate(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],

    _runManager?: CallbackManagerForLLMRun | undefined,
  ): Promise<ChatResult> {
    return this.caller.callWithOptions({ signal: options.signal }, async () => {
      const messageHistory = parseChatHistory(messages)
      const headers = {
        'Content-Type': 'application/json',
        Authorization: '',
        'x-folder-id': '',
      }
      if (this.apiKey !== undefined) {
        headers.Authorization = `Api-Key ${this.apiKey}`
        if (this.folderID !== undefined) {
          headers['x-folder-id'] = this.folderID
        }
      } else {
        headers.Authorization = `Bearer ${this.iamToken}`
      }
      const bodyData = {
        modelUri: this.modelURI,
        completionOptions: {
          temperature: this.temperature,
          maxTokens: this.maxTokens,
        },
        messages: messageHistory,
      }
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyData),
        signal: options?.signal,
      })

      const responseData = await response.json()

      if (!response.ok) {
        this.completionRetryCount += 1
        throw new HttpError(responseData.message || response.statusText, response)
      } else {
        this.completionRetryCount = 0
      }

      const { alternatives = [], usage } = responseData

      if (!alternatives.length) {
        throw new Error(`Failed to fetch ${apiUrl} from YandexGPT: alternatives empty`)
      }

      let { text } = alternatives[0].message
      const { totalTokens } = usage

      if (options.stop) {
        let minIndex = text.length

        for (const word of options.stop) {
          const index = text.indexOf(word)
          if (index !== -1 && index < minIndex) {
            minIndex = index
          }
        }
        text = text.substring(0, minIndex)
      }

      const generations: ChatGeneration[] = [{ text: text.replaceAll('**', '').trim(), message: new AIMessage(text) }]

      return {
        generations,
        llmOutput: { totalTokens },
      }
    })
  }
}

export const createResponseYandexGPT = async (
  text: string,
  settings?: Partial<Yandex>,
  _options?: Partial<YandexGPTInputs>,
  abortSignal?: AbortSignal,
) => {
  const modelURI = `gpt://${settings?.folder_id}/${settings?.model || YANDEX_DEFAULT_MODEL}`

  const response = await fetch(YANDEX_GPT_COMPLETION_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(settings?.apiKey && { Authorization: `Bearer ${settings.apiKey}` }),
    },
    body: JSON.stringify({
      modelUri: modelURI,
      messages: [{ role: 'user', text }],
      model: settings?.model || YANDEX_DEFAULT_MODEL,
    }),
    signal: abortSignal,
    credentials: 'include',
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(errorData.message || `Yandex API error: ${response.status}`)
  }

  const data = await response.json()
  return data.result.alternatives[0].message.text.replaceAll('**', '').trim()
}

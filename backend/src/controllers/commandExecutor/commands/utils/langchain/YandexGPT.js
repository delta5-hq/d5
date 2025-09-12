import debug from 'debug'
import {BaseLLM} from 'langchain/llms/base'
import fetch from 'node-fetch'
import {Embeddings} from 'langchain/embeddings/base'
import {delay} from '../../../../utils/delay'
import {DynamicTimeoutManager} from '../../../../integrations/yandex/DynamicTimeoutManager'

const apiUrl = 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion'

export class YandexGPT extends BaseLLM {
  lc_serializable = true

  static lc_name() {
    return 'YandexGPT'
  }

  get lc_secrets() {
    return {
      apiKey: 'YC_API_KEY',
      iamToken: 'YC_IAM_TOKEN',
      folderID: 'YC_FOLDER_ID',
    }
  }

  temperature = 0.2

  maxTokens = 1700

  model = 'yandexgpt'

  modelVersion = 'latest'

  modelURI

  apiKey

  iamToken

  folderID

  signal

  log

  constructor(fields) {
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
    this.log = fields?.log || debug('app:YandexGPT')
    this.syncCompletion = fields?.syncCompletion

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

  async syncCall(body, headers) {
    const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
      method: 'POST',
      body: JSON.stringify(body),
      headers,
    })

    if (!response.ok) {
      this.log('Error when try to send request yandexgpt', {status: response.status})
      throw new Error(`Failed to fetch ${apiUrl} from YandexGPT: ${response.status}`)
    }

    const {result} = await response.json()

    return result
  }

  async asyncCall(body, headers) {
    let retries = 3
    const timeoutManager = new DynamicTimeoutManager()

    let result

    const apiUrl = 'https://llm.api.cloud.yandex.net/foundationModels/v1/completionAsync'
    while (retries && !result) {
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: JSON.stringify(body),
        headers,
      })

      if (!response.ok) {
        this.log('Error when try to send request yandexgpt', {status: response.status})
        throw new Error(`Failed to fetch ${apiUrl} from YandexGPT: ${response.status}`)
      }

      const responseData = await response.json()

      const maxAttempts = timeoutManager.calculateTimeout(retries)
      let attempts = 0
      let operationStatus = responseData
      const operationUrl = `https://operation.api.cloud.yandex.net/operations/${operationStatus.id}`

      const startTime = Date.now()
      try {
        while (!operationStatus.done && attempts < maxAttempts) {
          const statusResponse = await fetch(operationUrl, {
            method: 'GET',
            headers,
          })

          if (statusResponse.status !== 200) {
            throw Error(`Failed to fetch ${operationUrl} from YandexGPT: ${response.status}`)
          }

          operationStatus = await statusResponse.json()

          if (!operationStatus.done) {
            await delay(1000)
          }

          attempts += 1
        }

        if (attempts === maxAttempts) {
          throw Error('YandexGPT request timeout')
        }

        if (operationStatus.error) {
          throw Error(operationStatus.error.message)
        }

        result = operationStatus.response
        retries -= 1
      } catch (e) {
        this.log(e.message)
      } finally {
        const duration = (Date.now() - startTime) / 1000
        timeoutManager.updateDuration(duration)
      }
    }

    if (!result) {
      throw Error('Can not get response from yandexgpt')
    }

    return result
  }

  /** @ignore */
  async _call(prompt, options) {
    return this.caller.callWithOptions({signal: options.signal}, async () => {
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
      const messages = [{role: 'user', text: prompt}]
      const bodyData = {
        modelUri: this.modelURI,
        completionOptions: {
          temperature: this.temperature,
          maxTokens: this.maxTokens,
        },
        messages,
      }
      this.log('Send request to yandexgpt', {prompt})
      try {
        let responseData

        if (this.syncCompletion) {
          responseData = await this.asyncCall(bodyData, headers)
        } else {
          responseData = await this.syncCall(bodyData, headers)
        }

        this.log('Get response from yandexgpt', {messages: responseData.alternatives.map(res => res.message)})
        return responseData.alternatives[0].message.text.replaceAll('**', '').trim()
      } catch (error) {
        throw new Error(`Failed to fetch ${apiUrl} from YandexGPT ${error}`)
      }
    })
  }

  async _generate(prompts, options) {
    return this.caller.callWithOptions({signal: options.signal}, async () => {
      const alternatives = []
      const tokenUsage = {completionTokens: 0, totalTokens: 0, inputTextTokens: 0}

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
        const messages = [{role: 'user', text: prompts[i]}]
        const bodyData = {
          modelUri: this.modelURI,
          completionOptions: {
            temperature: this.temperature,
            maxTokens: this.maxTokens,
          },
          messages,
        }
        this.log('Send request to yandexgpt', {prompt: prompts[i]})

        let responseData

        if (!this.syncCompletion) {
          responseData = await this.asyncCall(bodyData, headers)
        } else {
          responseData = await this.syncCall(bodyData, headers)
        }

        if (responseData?.alternatives?.length) {
          this.log('Get response from yandexgpt', {messages: responseData.alternatives.map(res => res.message)})
          alternatives.push(...responseData.alternatives)
        } else {
          this.log('Empty response data from yandexgpt', {responseData})
        }

        const {completionTokens, totalTokens, inputTextTokens} = responseData.usage ?? {}
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
        let {text} = a.message

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

        return {text: text.replaceAll('**', '').trim()}
      })

      if (!generations.length) {
        generations.push({
          text: 'Nothing',
        })
      }

      return {
        generations: [generations],
        llmOutput: {tokenUsage},
      }
    })
  }
}

const MAX_RETRIES = 3
const NUMBER_OF_WORKERS = 20
const MAX_CYCLE_COUNT = 100

const embeddingsApiUrl = 'https://llm.api.cloud.yandex.net/foundationModels/v1/textEmbedding'

export class YandexGPTEmbeddings extends Embeddings {
  model = 'text-search-query'
  modelVersion = 'latest'

  constructor(fields = {}) {
    super(fields)
    const {apiKey, iamToken, folderID, modelURI, model, modelVersion} = fields

    if (!apiKey && !iamToken) {
      throw new Error(
        'Please set the YC_API_KEY or YC_IAM_TOKEN environment variable or pass it to the constructor as the apiKey or iamToken field.',
      )
    }

    this._modelURI = modelURI
    this.apiKey = apiKey
    this.iamToken = iamToken
    this.folderID = folderID
    this.model = model ?? this.model
    this.modelVersion = modelVersion ?? this.modelVersion

    if (!this._modelURI && !folderID) {
      throw new Error(
        'Please set the YC_FOLDER_ID environment variable or pass Yandex GPT model URI to the constructor as the modelURI field.',
      )
    }
  }

  get modelURI() {
    return this._modelURI ? this._modelURI : `emb://${this.folderID}/${this.model}/${this.modelVersion}`
  }

  get lc_secrets() {
    return {
      apiKey: 'YC_API_KEY',
      iamToken: 'YC_IAM_TOKEN',
      folderID: 'YC_FOLDER_ID',
    }
  }

  async embedDocuments(texts) {
    this.model = 'text-search-doc'

    return this.embeddingWithRetry(texts)
  }

  async embedQuery(text) {
    this.model = 'text-search-query'

    const data = await this.embeddingWithRetry([text])
    return data[0]
  }

  _buildHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: this.apiKey ? `Api-Key ${this.apiKey}` : `Bearer ${this.iamToken}`,
    }
    if (this.folderID) {
      headers['x-folder-id'] = this.folderID
    }

    return headers
  }

  async _callEmbeddingAPI(init) {
    const response = await fetch(embeddingsApiUrl, {...init})

    if (!response.ok) {
      const error = new Error('Yandex Embeddings API error')
      error.response = response
      throw error
    }

    const responseData = await response.json()

    return responseData.embedding
  }

  async _embeddingWorker(chunksRemaining, chunksLimitReached, chunksInvalid) {
    let maxCycleCount = MAX_CYCLE_COUNT

    const embeddings = []

    while (chunksRemaining.length) {
      maxCycleCount -= 1
      if (!maxCycleCount) {
        throw new Error('Max cycle count reached')
      }

      const {chunk, retriesLeft} = chunksRemaining.shift()

      if (!retriesLeft) {
        chunksLimitReached.push(chunk)
        continue
      }
      try {
        const embedding = await this._callEmbeddingAPI({
          method: 'POST',
          headers: this._buildHeaders(),
          body: JSON.stringify({
            modelUri: this.modelURI,
            text: chunk,
          }),
        })

        embeddings.push(embedding)
      } catch (error) {
        if (error.response && error.response.status === 429) {
          chunksRemaining.push({chunk, retriesLeft: retriesLeft - 1})
        } else {
          chunksInvalid.push(chunk)
        }
      }
    }
    return embeddings
  }

  async _runWorkers(texts, numberOfWorkers, maxRetries) {
    const chunksRemaining = texts.map(chunk => ({chunk, retriesLeft: maxRetries}))
    const chunksLimitReached = []
    const chunksInvalid = []

    const resolvedWorkers = await Promise.all(
      Array.from({length: numberOfWorkers}, () =>
        this._embeddingWorker(chunksRemaining, chunksLimitReached, chunksInvalid),
      ),
    )

    return {chunksLimitReached, chunksInvalid, embeddings: resolvedWorkers.flatMap(val => val)}
  }

  async embeddingWithRetry(texts) {
    return this.caller.call(async () => {
      let chunksRemaining = texts.slice()
      let chunksInvalid = []

      let maxCycleCount = MAX_CYCLE_COUNT
      const embeddings = []

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

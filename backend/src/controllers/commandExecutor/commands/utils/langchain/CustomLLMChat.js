import {BaseChatModel} from 'langchain/chat_models/base'
import {AIMessage} from 'langchain/schema'
import fetch from 'node-fetch'
import {CustomLLMApiType, CUSTOM_LLM_TIMEOUT_MS} from '../../../../../constants'
import {Embeddings} from 'langchain/embeddings/base'
import {abortSignalAny, abortSignalTimeout} from './abortSignals'

export function cleanChainOfThoughtText(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
}

export function _parseChatHistory(history) {
  const chatHistory = []
  let systemPrompt = null
  let firstUserFound = false

  for (const message of history) {
    if (typeof message.content !== 'string') {
      throw new Error('ChatYandexGPT does not support non-string message content.')
    }

    const type = message._getType()
    const content = message.content.trim()

    if (type === 'system' && !systemPrompt) {
      systemPrompt = content
      continue
    }

    if (type === 'human') {
      let newContent = content
      if (systemPrompt && !firstUserFound) {
        newContent = `${systemPrompt}\n\n${content}`
        firstUserFound = true
      }
      chatHistory.push({role: 'user', content: newContent})
    } else if (type === 'ai') {
      chatHistory.push({role: 'assistant', content})
    }
  }

  return chatHistory
}

export class CustomLLMChat extends BaseChatModel {
  constructor(params) {
    super(params)

    if (!params.apiRootUrl) {
      throw Error('Api Url is required')
    }
    this.apiRootUrl = params.apiRootUrl

    if (!params.apiType) {
      throw Error('Api Type is required')
    }
    this.apiType = params.apiType

    this.apiKey = params.apiKey
    this.temperature = params.temperature ?? 1
    this.topP = params.topP ?? 1
    this.maxTokens = params.maxTokens
    this.frequency_penalty = params.frequencyPenalty ?? 0
    this.n = params.n ?? 1
    this.presence_penalty = params.presencePenalty ?? 0
  }

  _combineLLMOutput() {
    return {}
  }

  _llmType() {
    return 'custom_llm'
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(options) {
    return {
      temperature: this.temperature,
      top_p: this.topP,
      stop: options?.stop,
      max_tokens: this.maxTokens,
      presence_penalty: this.presence_penalty,
      n: this.n,
      frequency_penalty: this.frequency_penalty,
      stream: false,
    }
  }

  async _generate(
    messages,
    options,
    // eslint-disable-next-line no-unused-vars
    runManager,
  ) {
    const messageHistory = _parseChatHistory(messages)

    const apiUrl = `${this.apiRootUrl}/chat/completions`
    const timeout = CUSTOM_LLM_TIMEOUT_MS

    const timeoutSignal = abortSignalTimeout(timeout)
    const signal = options?.signal ? abortSignalAny([timeoutSignal, options.signal]) : timeoutSignal

    const headers = {
      'content-type': 'application/json',
      accept: 'application/json',
    }

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      body: JSON.stringify({
        messages: messageHistory,
        ...this.invocationParams(options),
      }),
      signal,
      headers,
    })

    if (!response.ok) {
      // TODO: error handler
      throw new Error(`Failed to fetch ${apiUrl}: ${response.status}`)
    }

    const responseData = await response.json()
    const {usage, choices} = responseData

    const generations = choices.map(c => {
      let text = c.message?.content || ''
      if (this.apiType === CustomLLMApiType.OpenAI_Compatible_Chain_Of_Thought) {
        text = cleanChainOfThoughtText(text)
      }
      return {text, message: new AIMessage(text)}
    })

    return {
      llmOutput: usage,
      generations,
    }
  }
}

export class CustomEmbeddings extends Embeddings {
  constructor(params) {
    super(params)
    if (!params.apiRootUrl) {
      throw new Error('Api Root Url is required')
    }

    this.apiRootUrl = params.apiRootUrl
    this.apiKey = params.apiKey
    this.batchSize = params.batchSize || 10
    this.stripNewLines = params.stripNewLines !== undefined ? params.stripNewLines : true
    this.params = params
  }

  chunkArray(array, size) {
    return Array.from({length: Math.ceil(array.length / size)}, (_, i) => array.slice(i * size, i * size + size))
  }

  async embedDocuments(texts) {
    const subPrompts = this.chunkArray(
      this.stripNewLines ? texts.map(t => t.replace(/\n/g, ' ')) : texts,
      this.batchSize,
    )
    const embeddings = []

    for (let i = 0; i < subPrompts.length; i++) {
      const input = subPrompts[i]
      const {data: newEmbeddings} = await this.embeddingWithRetry({input})
      embeddings.push(...newEmbeddings.map(emb => emb.embedding))
    }

    return embeddings
  }

  async embedQuery(text) {
    const {data: embedding} = await this.embeddingWithRetry({
      input: this.stripNewLines ? text.replace(/\n/g, ' ') : text,
    })
    return embedding[0].embedding
  }

  async embeddingWithRetry(request) {
    return this.caller.call(async () => {
      const timeout = CUSTOM_LLM_TIMEOUT_MS
      const headers = {
        'content-type': 'application/json',
        accept: 'application/json',
      }

      if (this.apiKey) {
        headers.Authorization = `Bearer ${this.apiKey}`
      }

      const response = await fetch(`${this.apiRootUrl}/embeddings`, {
        method: 'POST',
        body: JSON.stringify(request),
        headers,
        signal: abortSignalTimeout(timeout),
      })
      return response.json()
    })
  }
}

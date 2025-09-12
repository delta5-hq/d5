import {BaseChatModel} from 'langchain/chat_models/base'
import {AIMessage} from 'langchain/schema'
import {ANTHROPIC_VERSION, CLAUDE_API_URL} from '../../../../../shared/config/constants'
import fetch from 'node-fetch'

export function _parseChatHistory(history) {
  const chatHistory = []
  let systemPrompt = null

  for (const message of history) {
    if (typeof message.content !== 'string') {
      throw new Error('Chat does not support non-string message content.')
    }
    if ('content' in message) {
      const type = message._getType()
      if (type === 'human') {
        chatHistory.push({role: 'user', content: message.content})
      } else if (type === 'ai') {
        chatHistory.push({role: 'assistant', content: message.content})
      } else if (type === 'system' && systemPrompt === null) {
        systemPrompt = message.content
      }
    }
  }

  return {chatHistory, systemPrompt}
}

export class ChatClaude extends BaseChatModel {
  lc_serializable = true

  temperature = 1
  topK = -1
  topP = -1
  maxTokens = 2048
  modelName = 'claude-2.1'
  model = 'claude-2.1'
  completionRetryCount = 0

  constructor(fields) {
    super(fields ?? {})

    this.anthropicApiKey = fields?.apiKey ?? fields?.anthropicApiKey

    if (!this.anthropicApiKey) {
      throw new Error('Anthropic API key not found')
    }
    this.apiKey = this.anthropicApiKey

    this.apiUrl = fields?.anthropicApiUrl
    this.modelName = fields?.model ?? this.model
    this.model = this.modelName

    this.temperature = fields?.temperature ?? this.temperature
    this.topK = fields?.topK ?? this.topK
    this.topP = fields?.topP ?? this.topP
    this.maxTokens = fields?.maxTokens ?? this.maxTokens
    this.stopSequences = fields?.stopSequences ?? this.stopSequences
  }

  static lc_name() {
    return 'ChatAnthropic'
  }

  get lc_secrets() {
    return {
      anthropicApiKey: 'ANTHROPIC_API_KEY',
      apiKey: 'ANTHROPIC_API_KEY',
    }
  }

  get lc_aliases() {
    return {
      modelName: 'model',
    }
  }

  _llmType() {
    return 'claude'
  }

  _combineLLMOutput() {
    return {}
  }

  invocationParams(options) {
    return {
      model: this.model,
      temperature: this.temperature,
      top_k: this.topK,
      top_p: this.topP,
      stop_sequences: options?.stop ?? this.stopSequences,
      max_tokens: this.maxTokens,
      ...this.invocationKwargs,
    }
  }

  // eslint-disable-next-line no-unused-vars
  async _generate(messages, options, runManager) {
    const params = this.invocationParams(options)
    const {chatHistory, systemPrompt} = _parseChatHistory(messages)

    const makeCompletionRequest = async () => {
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      }

      const requestBody = {
        ...params,
        messages: chatHistory,
        system: systemPrompt ?? undefined,
      }

      const response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: options?.signal,
      })

      const data = await response.json()
      return data
    }

    const response = await this.caller.callWithOptions({signal: options.signal ?? undefined}, makeCompletionRequest)

    const {content, ...additionalKwargs} = response

    const generations = content
      .filter(message => message.type === 'text')
      .map(message => ({
        text: message.text,
        message: new AIMessage(message.text),
      }))

    const {role, type, ...rest} = additionalKwargs
    return {generations, llmOutput: rest}
  }
}

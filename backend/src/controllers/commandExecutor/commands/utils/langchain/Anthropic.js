import {BaseChatModel} from '@langchain/core/language_models/chat_models'
import {AIMessage} from '@langchain/core/messages'
import {ANTHROPIC_VERSION, CLAUDE_API_URL} from '../../../../../shared/config/constants'
import fetch from 'node-fetch'
import {formatToolsForAnthropic, extractToolCallsFromContent} from './AnthropicToolFormatter'

export function _parseChatHistory(history) {
  const chatHistory = []
  let systemPrompt = null

  for (const message of history) {
    const type = message._getType()

    if (type === 'system') {
      if (systemPrompt === null) systemPrompt = message.content
      continue
    }

    if (type === 'human') {
      if (typeof message.content !== 'string') {
        throw new Error('Chat does not support non-string content in human messages.')
      }
      chatHistory.push({role: 'user', content: message.content})
      continue
    }

    if (type === 'ai') {
      const toolCalls = message.tool_calls || []
      if (toolCalls.length > 0) {
        const content = []
        if (message.content && typeof message.content === 'string' && message.content.trim()) {
          content.push({type: 'text', text: message.content})
        }
        for (const tc of toolCalls) {
          content.push({type: 'tool_use', id: tc.id, name: tc.name, input: tc.args || {}})
        }
        chatHistory.push({role: 'assistant', content})
      } else {
        const text = typeof message.content === 'string' ? message.content : ''
        chatHistory.push({role: 'assistant', content: text})
      }
      continue
    }

    if (type === 'tool') {
      const toolResult = {
        type: 'tool_result',
        tool_use_id: message.tool_call_id,
        content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
      }
      const last = chatHistory[chatHistory.length - 1]
      if (last && last.role === 'user' && Array.isArray(last.content)) {
        last.content.push(toolResult)
      } else {
        chatHistory.push({role: 'user', content: [toolResult]})
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
  thinkingBudgetTokens = null

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
    this.thinkingBudgetTokens = fields?.thinkingBudgetTokens ?? null
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

  bindTools(tools) {
    const bound = new ChatClaude({
      apiKey: this.apiKey,
      model: this.modelName,
      temperature: this.temperature,
      topK: this.topK,
      topP: this.topP,
      maxTokens: this.maxTokens,
      ...(this.stopSequences && {stopSequences: this.stopSequences}),
      ...(this.thinkingBudgetTokens !== null && {
        thinkingBudgetTokens: this.thinkingBudgetTokens,
      }),
    })
    bound._boundTools = formatToolsForAnthropic(tools)
    return bound
  }

  invocationParams(options) {
    const tools = options?.tools ?? this._boundTools ?? []
    return {
      model: this.model,
      temperature: this.temperature,
      ...(this.topK >= 0 ? {top_k: this.topK} : {}),
      ...(this.topP >= 0 ? {top_p: this.topP} : {}),
      stop_sequences: options?.stop ?? this.stopSequences,
      max_tokens: this.maxTokens,
      ...(tools.length ? {tools} : {}),
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
        ...(this.thinkingBudgetTokens
          ? {
              thinking: {
                type: 'enabled',
                budget_tokens: this.thinkingBudgetTokens,
              },
              temperature: 1,
            }
          : {}),
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

    const textContent = content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('')
    const toolCalls = extractToolCallsFromContent(content)

    const message = new AIMessage({
      content: textContent,
      tool_calls: toolCalls,
    })
    const {role, type, ...rest} = additionalKwargs
    return {generations: [{text: textContent, message}], llmOutput: rest}
  }
}

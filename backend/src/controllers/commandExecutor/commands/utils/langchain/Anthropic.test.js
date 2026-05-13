import {ChatClaude, _parseChatHistory} from './Anthropic'
import {HumanMessage, AIMessage, SystemMessage} from '@langchain/core/messages'
import fetch from 'node-fetch'

jest.mock('node-fetch', () => jest.fn())

describe('Claude parseChatHistory', () => {
  it('should extract system message as top-level field and not include it in messages array', () => {
    const history = [
      new SystemMessage('Respond with one of these options: red or blue.'),
      new HumanMessage('Is cat red or blue?'),
      new AIMessage('Red.'),
    ]

    const {chatHistory, systemPrompt} = _parseChatHistory(history)

    expect(systemPrompt).toBe('Respond with one of these options: red or blue.')

    expect(chatHistory).toEqual([
      {role: 'user', content: 'Is cat red or blue?'},
      {role: 'assistant', content: 'Red.'},
    ])

    const hasSystem = chatHistory.some(msg => msg.role === 'system')
    expect(hasSystem).toBe(false)
  })
})

describe('ChatClaude request formatting', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('sends correct request body with system message at top level', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        content: [{type: 'text', text: 'Blue'}],
      }),
    })

    const claude = new ChatClaude({
      apiKey: 'test-key',
      model: 'claude-3-sonnet-20240229',
      temperature: 0.7,
      topK: 10,
      topP: 0.9,
      maxTokens: 1000,
    })

    const messages = [new SystemMessage('Be concise.'), new HumanMessage('What color is the sky?')]

    await claude.invoke(messages)

    const body = JSON.parse(fetch.mock.calls[0][1].body)

    expect(body.system).toBe('Be concise.')
    expect(body.messages).toEqual([{role: 'user', content: 'What color is the sky?'}])
    expect(body.model).toBe('claude-3-sonnet-20240229')
    expect(body.temperature).toBe(0.7)
    expect(body.top_k).toBe(10)
    expect(body.top_p).toBe(0.9)
    expect(body.max_tokens).toBe(1000)

    const systemInMessages = body.messages.some(m => m.role === 'system')
    expect(systemInMessages).toBe(false)
  })

  it('does not include apiKey or constructor kwargs in the request body', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        content: [{type: 'text', text: 'OK'}],
      }),
    })

    const claude = new ChatClaude({
      apiKey: 'secret-key',
      model: 'claude-3-haiku-20240307',
      maxRetries: 3,
    })

    await claude.invoke([new HumanMessage('Hi')])

    const body = JSON.parse(fetch.mock.calls[0][1].body)

    expect(body).not.toHaveProperty('apiKey')
    expect(body).not.toHaveProperty('anthropicApiKey')
    expect(body).not.toHaveProperty('maxRetries')
  })

  it('sends apiKey exclusively in the x-api-key header, not in the body', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        content: [{type: 'text', text: 'OK'}],
      }),
    })

    const claude = new ChatClaude({apiKey: 'header-only-key', model: 'claude-3-haiku-20240307'})

    await claude.invoke([new HumanMessage('Ping')])

    const [, init] = fetch.mock.calls[0]
    expect(init.headers['x-api-key']).toBe('header-only-key')
    const body = JSON.parse(init.body)
    expect(body).not.toHaveProperty('apiKey')
  })

  it('request body contains only Anthropic-accepted fields', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        content: [{type: 'text', text: 'OK'}],
      }),
    })

    const claude = new ChatClaude({
      apiKey: 'test-key',
      model: 'claude-3-haiku-20240307',
      temperature: 0.5,
      topK: 5,
      topP: 0.8,
      maxTokens: 512,
    })

    await claude.invoke([new HumanMessage('Test')])

    const body = JSON.parse(fetch.mock.calls[0][1].body)
    const bodyKeys = Object.keys(body)
    const acceptedKeys = [
      'model',
      'messages',
      'system',
      'temperature',
      'top_k',
      'top_p',
      'max_tokens',
      'stop_sequences',
    ]

    for (const key of bodyKeys) {
      expect(acceptedKeys).toContain(key)
    }
  })
})

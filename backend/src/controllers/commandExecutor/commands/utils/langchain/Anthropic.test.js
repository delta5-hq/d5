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

describe('ChatClaude invocationParams', () => {
  describe('optional sampling parameters', () => {
    it('omits top_k and top_p when neither has been configured', () => {
      const claude = new ChatClaude({apiKey: 'test-key'})
      const params = claude.invocationParams({})
      expect(params).not.toHaveProperty('top_k')
      expect(params).not.toHaveProperty('top_p')
    })

    it.each([
      ['positive integer', 10],
      ['zero — a valid sampling boundary', 0],
    ])('includes top_k when configured as a %s', (_label, topK) => {
      expect(new ChatClaude({apiKey: 'test-key', topK}).invocationParams({}).top_k).toBe(topK)
    })

    it.each([
      ['fraction', 0.9],
      ['zero — a valid probability boundary', 0],
    ])('includes top_p when configured as a %s', (_label, topP) => {
      expect(new ChatClaude({apiKey: 'test-key', topP}).invocationParams({}).top_p).toBe(topP)
    })

    it('includes both top_k and top_p when both are explicitly configured', () => {
      const params = new ChatClaude({apiKey: 'test-key', topK: 5, topP: 0.8}).invocationParams({})
      expect(params.top_k).toBe(5)
      expect(params.top_p).toBe(0.8)
    })
  })

  it('always includes model, temperature, and max_tokens regardless of optional params', () => {
    const params = new ChatClaude({
      apiKey: 'test-key',
      model: 'claude-3-haiku',
      temperature: 0.5,
      maxTokens: 512,
    }).invocationParams({})
    expect(params.model).toBe('claude-3-haiku')
    expect(params.temperature).toBe(0.5)
    expect(params.max_tokens).toBe(512)
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

  it('omits top_k and top_p from the request body when neither has been configured', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({content: [{type: 'text', text: 'ok'}]}),
    })
    await new ChatClaude({apiKey: 'test-key'}).invoke([new HumanMessage('hi')])
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body).not.toHaveProperty('top_k')
    expect(body).not.toHaveProperty('top_p')
  })
})

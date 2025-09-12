import {ChatClaude, _parseChatHistory} from './Anthropic'
import {HumanMessage, AIMessage, SystemMessage} from 'langchain/schema'
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

    await claude.call(messages)

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
})

import {_parseChatHistory, CustomLLMChat} from './CustomLLMChat'
import {HumanMessage, AIMessage, SystemMessage} from 'langchain/schema'
import fetch from 'node-fetch'
import {CustomLLMApiType} from '../../../../../constants'

jest.mock('node-fetch', () => jest.fn())

describe('CustomLLMChat parseChatHistory', () => {
  it('should prepend system prompt to first user message', () => {
    const history = [
      new SystemMessage('Respond with one of these options: red or blue.'),
      new HumanMessage('Is cat red or blue?'),
      new AIMessage('Red.'),
    ]

    const chatHistory = _parseChatHistory(history)

    expect(chatHistory).toEqual([
      {
        role: 'user',
        content: 'Respond with one of these options: red or blue.\n\nIs cat red or blue?',
      },
      {role: 'assistant', content: 'Red.'},
    ])

    const hasSystem = chatHistory.some(msg => msg.role === 'system')
    expect(hasSystem).toBe(false)
  })
})

describe('CustomLLMChat request formatting', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('sends correct request body with system message at top of user message', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{message: {content: 'Blue'}}],
        usage: {},
      }),
    })

    const llm = new CustomLLMChat({
      apiRootUrl: 'http://localhost:3000',
      apiType: CustomLLMApiType.OpenAI_Compatible,
    })

    const messages = [new SystemMessage('Be concise.'), new HumanMessage('What color is the sky?')]

    await llm.call(messages)

    const fetchCall = fetch.mock.calls[0]
    const body = JSON.parse(fetchCall[1].body)

    expect(body.messages).toEqual([
      {
        role: 'user',
        content: 'Be concise.\n\nWhat color is the sky?',
      },
    ])

    const systemInMessages = body.messages.some(m => m.role === 'system')
    expect(systemInMessages).toBe(false)
  })
})

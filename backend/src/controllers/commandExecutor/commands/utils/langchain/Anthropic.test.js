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

describe('_parseChatHistory', () => {
  it('returns null systemPrompt when no system message is present', () => {
    const {systemPrompt} = _parseChatHistory([new HumanMessage('hi'), new AIMessage('hello')])
    expect(systemPrompt).toBeNull()
  })

  it('uses only the first system message when multiple appear', () => {
    const {systemPrompt, chatHistory} = _parseChatHistory([
      new SystemMessage('First system'),
      new HumanMessage('hi'),
      new SystemMessage('Second system — ignored'),
    ])
    expect(systemPrompt).toBe('First system')
    expect(chatHistory).toEqual([{role: 'user', content: 'hi'}])
  })

  it('maps HumanMessage to user role and AIMessage to assistant role', () => {
    const {chatHistory} = _parseChatHistory([new HumanMessage('question'), new AIMessage('answer')])
    expect(chatHistory).toEqual([
      {role: 'user', content: 'question'},
      {role: 'assistant', content: 'answer'},
    ])
  })

  it('system message never appears in chatHistory', () => {
    const {chatHistory} = _parseChatHistory([new SystemMessage('be concise'), new HumanMessage('hi')])
    expect(chatHistory.some(m => m.role === 'system')).toBe(false)
  })

  it('returns empty chatHistory and null systemPrompt for empty history', () => {
    const {chatHistory, systemPrompt} = _parseChatHistory([])
    expect(chatHistory).toEqual([])
    expect(systemPrompt).toBeNull()
  })

  it('throws when a human message has non-string content', () => {
    const badMessage = {content: ['array', 'content'], _getType: () => 'human'}
    expect(() => _parseChatHistory([badMessage])).toThrow('Chat does not support non-string content in human messages.')
  })

  it('converts AIMessage with tool_calls to Anthropic tool_use format', () => {
    const {chatHistory} = _parseChatHistory([
      new HumanMessage('Search for it'),
      new AIMessage({content: '', tool_calls: [{id: 'tool_1', name: 'search', args: {q: 'test'}}]}),
    ])
    expect(chatHistory).toEqual([
      {role: 'user', content: 'Search for it'},
      {role: 'assistant', content: [{type: 'tool_use', id: 'tool_1', name: 'search', input: {q: 'test'}}]},
    ])
  })

  it('includes text content before tool_use blocks when assistant has both', () => {
    const {chatHistory} = _parseChatHistory([
      new HumanMessage('q'),
      new AIMessage({content: 'Let me check.', tool_calls: [{id: 'id1', name: 'tool_a', args: {}}]}),
    ])
    expect(chatHistory[1]).toEqual({
      role: 'assistant',
      content: [
        {type: 'text', text: 'Let me check.'},
        {type: 'tool_use', id: 'id1', name: 'tool_a', input: {}},
      ],
    })
  })

  it('converts ToolMessage to Anthropic tool_result in a user message', () => {
    const ToolMessage = require('@langchain/core/messages').ToolMessage
    const {chatHistory} = _parseChatHistory([
      new HumanMessage('q'),
      new AIMessage({content: '', tool_calls: [{id: 'tool_1', name: 'search', args: {q: 'x'}}]}),
      new ToolMessage({content: 'result text', tool_call_id: 'tool_1'}),
    ])
    expect(chatHistory[2]).toEqual({
      role: 'user',
      content: [{type: 'tool_result', tool_use_id: 'tool_1', content: 'result text'}],
    })
  })

  it('merges multiple consecutive ToolMessages into one user message', () => {
    const ToolMessage = require('@langchain/core/messages').ToolMessage
    const {chatHistory} = _parseChatHistory([
      new HumanMessage('q'),
      new AIMessage({
        content: '',
        tool_calls: [
          {id: 'id1', name: 'a', args: {}},
          {id: 'id2', name: 'b', args: {}},
        ],
      }),
      new ToolMessage({content: 'result_a', tool_call_id: 'id1'}),
      new ToolMessage({content: 'result_b', tool_call_id: 'id2'}),
    ])
    expect(chatHistory[2]).toEqual({
      role: 'user',
      content: [
        {type: 'tool_result', tool_use_id: 'id1', content: 'result_a'},
        {type: 'tool_result', tool_use_id: 'id2', content: 'result_b'},
      ],
    })
    expect(chatHistory).toHaveLength(3)
  })
})

describe('ChatClaude invocationParams — stop sequences', () => {
  it('uses options.stop as stop_sequences when provided', () => {
    const params = new ChatClaude({apiKey: 'key'}).invocationParams({stop: ['</s>', 'END']})
    expect(params.stop_sequences).toEqual(['</s>', 'END'])
  })

  it('falls back to instance stopSequences when options.stop is absent', () => {
    const params = new ChatClaude({apiKey: 'key', stopSequences: ['STOP']}).invocationParams({})
    expect(params.stop_sequences).toEqual(['STOP'])
  })
})

describe('ChatClaude bindTools', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns a ChatClaude instance', () => {
    const claude = new ChatClaude({apiKey: 'key'})
    const bound = claude.bindTools([{name: 't', description: 'd', inputSchema: {type: 'object', properties: {}}}])
    expect(bound).toBeInstanceOf(ChatClaude)
  })

  it('returns a new instance — does not mutate the original', () => {
    const claude = new ChatClaude({apiKey: 'key'})
    const bound = claude.bindTools([{name: 't', description: 'd', inputSchema: {type: 'object', properties: {}}}])
    expect(bound).not.toBe(claude)
  })

  it('original model has no bound tools after bindTools is called on it', () => {
    const claude = new ChatClaude({apiKey: 'key'})
    claude.bindTools([{name: 't', description: 'd', inputSchema: {type: 'object', properties: {}}}])
    expect(claude._boundTools).toBeUndefined()
  })

  it('preserves source model settings on the bound instance', () => {
    const claude = new ChatClaude({
      apiKey: 'sk-test',
      model: 'claude-3-opus',
      temperature: 0.3,
      topK: 5,
      topP: 0.7,
      maxTokens: 512,
    })
    const bound = claude.bindTools([])
    expect(bound.model).toBe('claude-3-opus')
    expect(bound.temperature).toBe(0.3)
    expect(bound.topK).toBe(5)
    expect(bound.topP).toBe(0.7)
    expect(bound.maxTokens).toBe(512)
  })

  it('sends tools in Anthropic format in the request body', async () => {
    fetch.mockResolvedValue({ok: true, json: jest.fn().mockResolvedValue({content: [{type: 'text', text: 'ok'}]})})

    const inputSchema = {type: 'object', properties: {q: {type: 'string'}}, required: ['q']}
    const bound = new ChatClaude({apiKey: 'key'}).bindTools([{name: 'search', description: 'Search', inputSchema}])
    await bound.invoke([new HumanMessage('hi')])

    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.tools).toHaveLength(1)
    expect(body.tools[0]).toEqual({name: 'search', description: 'Search', input_schema: inputSchema})
  })

  it('sends all tools when multiple are bound', async () => {
    fetch.mockResolvedValue({ok: true, json: jest.fn().mockResolvedValue({content: [{type: 'text', text: 'ok'}]})})

    const tools = [
      {name: 'tool_a', description: 'A', inputSchema: {type: 'object', properties: {}}},
      {name: 'tool_b', description: 'B', inputSchema: {type: 'object', properties: {}}},
      {name: 'tool_c', description: 'C', inputSchema: {type: 'object', properties: {}}},
    ]
    await new ChatClaude({apiKey: 'key'}).bindTools(tools).invoke([new HumanMessage('hi')])

    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.tools).toHaveLength(3)
    expect(body.tools.map(t => t.name)).toEqual(['tool_a', 'tool_b', 'tool_c'])
  })

  it('omits tools from request body when empty array is bound', async () => {
    fetch.mockResolvedValue({ok: true, json: jest.fn().mockResolvedValue({content: [{type: 'text', text: 'ok'}]})})

    await new ChatClaude({apiKey: 'key'}).bindTools([]).invoke([new HumanMessage('hi')])

    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body).not.toHaveProperty('tools')
  })

  it('omits tools from request body when no tools are bound', async () => {
    fetch.mockResolvedValue({ok: true, json: jest.fn().mockResolvedValue({content: [{type: 'text', text: 'ok'}]})})

    await new ChatClaude({apiKey: 'key'}).invoke([new HumanMessage('hi')])

    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body).not.toHaveProperty('tools')
  })
})

describe('ChatClaude tool_use response parsing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns empty tool_calls and full text content for text-only response', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({content: [{type: 'text', text: 'Plain answer'}]}),
    })

    const result = await new ChatClaude({apiKey: 'key'}).invoke([new HumanMessage('hi')])

    expect(result.content).toBe('Plain answer')
    expect(result.tool_calls).toHaveLength(0)
  })

  it('returns empty content string and tool calls for tool-use-only response', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        content: [{type: 'tool_use', id: 'toolu_01', name: 'search', input: {q: 'test'}}],
      }),
    })

    const result = await new ChatClaude({apiKey: 'key'}).invoke([new HumanMessage('search for it')])

    expect(result.content).toBe('')
    expect(result.tool_calls).toHaveLength(1)
    expect(result.tool_calls[0]).toMatchObject({id: 'toolu_01', name: 'search', args: {q: 'test'}})
  })

  it('concatenates multiple text blocks into a single content string', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        content: [
          {type: 'text', text: 'Hello '},
          {type: 'text', text: 'world'},
        ],
      }),
    })

    const result = await new ChatClaude({apiKey: 'key'}).invoke([new HumanMessage('hi')])
    expect(result.content).toBe('Hello world')
  })

  it('extracts multiple tool_use blocks as separate tool calls in order', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        content: [
          {type: 'tool_use', id: 'id1', name: 'tool_a', input: {x: 1}},
          {type: 'tool_use', id: 'id2', name: 'tool_b', input: {y: 2}},
        ],
      }),
    })

    const result = await new ChatClaude({apiKey: 'key'}).invoke([new HumanMessage('do both')])

    expect(result.tool_calls).toHaveLength(2)
    expect(result.tool_calls[0]).toMatchObject({id: 'id1', name: 'tool_a', args: {x: 1}})
    expect(result.tool_calls[1]).toMatchObject({id: 'id2', name: 'tool_b', args: {y: 2}})
  })

  it('ignores thinking blocks — they do not appear in content or tool_calls', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        content: [
          {type: 'thinking', thinking: 'Let me reason step by step...'},
          {type: 'text', text: 'Final answer'},
          {type: 'tool_use', id: 'id1', name: 'fn', input: {}},
        ],
      }),
    })

    const result = await new ChatClaude({apiKey: 'key'}).invoke([new HumanMessage('think')])

    expect(result.content).toBe('Final answer')
    expect(result.tool_calls).toHaveLength(1)
  })
})

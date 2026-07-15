import {ChatClaude, _parseChatHistory} from './Anthropic'
import {AIMessage, HumanMessage, SystemMessage} from '@langchain/core/messages'
import fetch from 'node-fetch'

jest.mock('node-fetch')

const makeSuccessResponse = (overrides = {}) =>
  Object.assign(
    {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        content: [{type: 'text', text: 'hello'}],
        role: 'assistant',
        type: 'message',
        usage: {input_tokens: 10, output_tokens: 5},
      }),
    },
    overrides,
  )

const makeErrorResponse = (status, body) => ({
  ok: false,
  status,
  statusText: String(status),
  json: async () => body,
})

const makeInstance = (fields = {}) => new ChatClaude({apiKey: 'test-api-key', maxRetries: 0, ...fields})

const humanMsg = content => ({content, _getType: () => 'human'})
const aiMsg = content => ({content, _getType: () => 'ai'})
const systemMsg = content => ({content, _getType: () => 'system'})

describe('ChatClaude._generate', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = require('node-fetch')
    fetchMock.mockReset()
  })

  describe('response.ok guard — explicit throw on non-2xx', () => {
    it.each([400, 401, 403, 429, 500, 503])(
      'throws "Anthropic API error: <message>" when status is %i and body has error.message',
      async status => {
        fetchMock.mockResolvedValue(makeErrorResponse(status, {error: {message: `error-for-${status}`}}))
        await expect(makeInstance()._generate([humanMsg('hi')], {})).rejects.toThrow(
          `Anthropic API error: error-for-${status}`,
        )
      },
    )

    it('falls back to "HTTP <status>" when the error body has no message field', async () => {
      fetchMock.mockResolvedValue(makeErrorResponse(403, {type: 'error', error: {type: 'permission_error'}}))
      await expect(makeInstance()._generate([humanMsg('hi')], {})).rejects.toThrow('HTTP 403')
    })

    it('falls back to "HTTP <status>" when the error body is not parseable JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => {
          throw new SyntaxError('Unexpected token')
        },
      })
      await expect(makeInstance()._generate([humanMsg('hi')], {})).rejects.toThrow('HTTP 500')
    })

    it('falls back to "HTTP <status>" when the error body is null', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => null,
      })
      await expect(makeInstance()._generate([humanMsg('hi')], {})).rejects.toThrow('HTTP 503')
    })
  })

  describe('success path — 200 response handling', () => {
    it('resolves with a single text generation from a single-block response', async () => {
      fetchMock.mockResolvedValue(makeSuccessResponse())
      const result = await makeInstance()._generate([humanMsg('hi')], {})
      expect(result.generations).toHaveLength(1)
      expect(result.generations[0].text).toBe('hello')
    })

    it('resolves with one concatenated generation when the response has multiple text blocks', async () => {
      fetchMock.mockResolvedValue(
        makeSuccessResponse({
          json: async () => ({
            content: [
              {type: 'text', text: 'first'},
              {type: 'text', text: 'second'},
            ],
            role: 'assistant',
            type: 'message',
            usage: {},
          }),
        }),
      )
      const result = await makeInstance()._generate([humanMsg('hi')], {})
      expect(result.generations).toHaveLength(1)
      expect(result.generations[0].text).toBe('firstsecond')
    })

    it('filters out non-text content blocks — only type:text produces a generation', async () => {
      fetchMock.mockResolvedValue(
        makeSuccessResponse({
          json: async () => ({
            content: [
              {type: 'thinking', thinking: 'internal reasoning'},
              {type: 'text', text: 'visible answer'},
            ],
            role: 'assistant',
            type: 'message',
            usage: {},
          }),
        }),
      )
      const result = await makeInstance()._generate([humanMsg('hi')], {})
      expect(result.generations).toHaveLength(1)
      expect(result.generations[0].text).toBe('visible answer')
    })

    it('returns one empty generation when the response has no text blocks', async () => {
      fetchMock.mockResolvedValue(
        makeSuccessResponse({
          json: async () => ({
            content: [{type: 'thinking', thinking: 'only thinking'}],
            role: 'assistant',
            type: 'message',
            usage: {},
          }),
        }),
      )
      const result = await makeInstance()._generate([humanMsg('hi')], {})
      expect(result.generations).toHaveLength(1)
      expect(result.generations[0].text).toBe('')
    })
  })

  describe('request serialization', () => {
    const captureRequestBody = () => JSON.parse(fetchMock.mock.calls[0][1].body)

    beforeEach(() => {
      fetchMock.mockResolvedValue(makeSuccessResponse())
    })

    it('sends human messages as role:user', async () => {
      await makeInstance()._generate([humanMsg('question')], {})
      expect(captureRequestBody().messages).toContainEqual({role: 'user', content: 'question'})
    })

    it('sends ai messages as role:assistant', async () => {
      await makeInstance()._generate([humanMsg('q'), aiMsg('a'), humanMsg('follow-up')], {})
      expect(captureRequestBody().messages).toContainEqual({role: 'assistant', content: 'a'})
    })

    it('lifts the system message into the top-level system field — not into messages array', async () => {
      await makeInstance()._generate([systemMsg('be helpful'), humanMsg('hi')], {})
      const body = captureRequestBody()
      expect(body.system).toBe('be helpful')
      expect(body.messages.every(m => m.role !== 'system')).toBe(true)
    })

    it('omits the system field when no system message is present', async () => {
      await makeInstance()._generate([humanMsg('hi')], {})
      expect(captureRequestBody().system).toBeUndefined()
    })

    it('adds thinking block when thinkingBudgetTokens is set', async () => {
      await makeInstance({thinkingBudgetTokens: 1024})._generate([humanMsg('hi')], {})
      const body = captureRequestBody()
      expect(body.thinking).toEqual({type: 'enabled', budget_tokens: 1024})
    })

    it('omits thinking block when thinkingBudgetTokens is null', async () => {
      await makeInstance()._generate([humanMsg('hi')], {})
      expect(captureRequestBody().thinking).toBeUndefined()
    })

    it('overrides temperature to 1 when thinking is enabled', async () => {
      await makeInstance({thinkingBudgetTokens: 512, temperature: 0.5})._generate([humanMsg('hi')], {})
      expect(captureRequestBody().temperature).toBe(1)
    })

    it('sends model, temperature, and max_tokens from ChatClaude configuration', async () => {
      await makeInstance({model: 'claude-3-haiku-20240307', temperature: 0.3, maxTokens: 512})._generate(
        [humanMsg('hi')],
        {},
      )
      const body = captureRequestBody()
      expect(body.model).toBe('claude-3-haiku-20240307')
      expect(body.temperature).toBe(0.3)
      expect(body.max_tokens).toBe(512)
    })

    it('includes top_k in the request body when configured', async () => {
      await makeInstance({topK: 10})._generate([humanMsg('hi')], {})
      expect(captureRequestBody().top_k).toBe(10)
    })

    it('includes top_p in the request body when configured', async () => {
      await makeInstance({topP: 0.9})._generate([humanMsg('hi')], {})
      expect(captureRequestBody().top_p).toBe(0.9)
    })

    it('omits top_k from the request body when not configured', async () => {
      await makeInstance()._generate([humanMsg('hi')], {})
      expect(captureRequestBody()).not.toHaveProperty('top_k')
    })

    it('omits top_p from the request body when not configured', async () => {
      await makeInstance()._generate([humanMsg('hi')], {})
      expect(captureRequestBody()).not.toHaveProperty('top_p')
    })
  })
})

describe('_parseChatHistory', () => {
  const humanMsg = content => ({content, _getType: () => 'human'})
  const aiMsg = content => ({content, _getType: () => 'ai'})
  const systemMsg = content => ({content, _getType: () => 'system'})

  it('maps human messages to role:user entries', () => {
    const {chatHistory} = _parseChatHistory([humanMsg('hello')])
    expect(chatHistory).toEqual([{role: 'user', content: 'hello'}])
  })

  it('maps ai messages to role:assistant entries', () => {
    const {chatHistory} = _parseChatHistory([humanMsg('q'), aiMsg('a')])
    expect(chatHistory).toContainEqual({role: 'assistant', content: 'a'})
  })

  it('extracts a system message into systemPrompt — not into chatHistory', () => {
    const {chatHistory, systemPrompt} = _parseChatHistory([systemMsg('be concise'), humanMsg('hi')])
    expect(systemPrompt).toBe('be concise')
    expect(chatHistory.every(m => m.role !== 'system')).toBe(true)
  })

  it('returns null systemPrompt when no system message is present', () => {
    const {systemPrompt} = _parseChatHistory([humanMsg('hi')])
    expect(systemPrompt).toBeNull()
  })

  it('uses only the first system message when multiple system messages appear', () => {
    const {systemPrompt} = _parseChatHistory([systemMsg('first'), systemMsg('second'), humanMsg('hi')])
    expect(systemPrompt).toBe('first')
  })

  it('preserves message order in chatHistory', () => {
    const {chatHistory} = _parseChatHistory([humanMsg('a'), aiMsg('b'), humanMsg('c')])
    expect(chatHistory).toEqual([
      {role: 'user', content: 'a'},
      {role: 'assistant', content: 'b'},
      {role: 'user', content: 'c'},
    ])
  })

  it('throws when a message has non-string content', () => {
    expect(() => _parseChatHistory([{content: ['array'], _getType: () => 'human'}])).toThrow(
      'Chat does not support non-string content in human messages.',
    )
  })

  it('returns empty chatHistory and null systemPrompt for an empty history', () => {
    const {chatHistory, systemPrompt} = _parseChatHistory([])
    expect(chatHistory).toEqual([])
    expect(systemPrompt).toBeNull()
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

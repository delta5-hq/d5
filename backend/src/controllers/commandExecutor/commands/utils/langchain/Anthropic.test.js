import {ChatClaude, _parseChatHistory} from './Anthropic'

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

    it('resolves with multiple generations when the response has multiple text blocks', async () => {
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
      expect(result.generations).toHaveLength(2)
      expect(result.generations.map(g => g.text)).toEqual(['first', 'second'])
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

    it('returns an empty generations array when the response has no text blocks', async () => {
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
      expect(result.generations).toHaveLength(0)
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
      'Chat does not support non-string message content.',
    )
  })

  it('returns empty chatHistory and null systemPrompt for an empty history', () => {
    const {chatHistory, systemPrompt} = _parseChatHistory([])
    expect(chatHistory).toEqual([])
    expect(systemPrompt).toBeNull()
  })
})

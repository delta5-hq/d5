import CustomLLMController from './CustomLLMController'
import fetch from 'node-fetch'

jest.mock('node-fetch')

const createMockContext = (requestBody, authHeader = null) => {
  const ctx = {
    headers: authHeader ? {authorization: authHeader} : {},
    request: {
      json: jest.fn().mockResolvedValue(requestBody),
    },
    throw: jest.fn((status, message) => {
      const error = new Error(message)
      error.status = status
      throw error
    }),
  }
  return ctx
}

describe('CustomLLMController', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('chatCompletions', () => {
    it('should proxy request to custom LLM and return response', async () => {
      const mockResponse = {
        choices: [{message: {role: 'assistant', content: 'Hello World'}}],
        usage: {prompt_tokens: 10, completion_tokens: 5},
      }

      fetch.mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify(mockResponse)),
      })

      const ctx = createMockContext(
        {
          url: 'https://custom-llm.example.com',
          model: 'test-model',
          messages: [{role: 'user', content: 'Hello'}],
        },
        'Bearer test-api-key',
      )

      await CustomLLMController.chatCompletions(ctx)

      expect(fetch).toHaveBeenCalledWith(
        'https://custom-llm.example.com/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            Authorization: 'Bearer test-api-key',
          },
          body: JSON.stringify({
            model: 'test-model',
            messages: [{role: 'user', content: 'Hello'}],
          }),
        }),
      )

      expect(ctx.body).toEqual(mockResponse)
    })

    it('should work without API key', async () => {
      const mockResponse = {choices: [{message: {content: 'Response'}}]}

      fetch.mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify(mockResponse)),
      })

      const ctx = createMockContext({
        url: 'https://custom-llm.example.com',
        messages: [{role: 'user', content: 'Test'}],
      })

      await CustomLLMController.chatCompletions(ctx)

      expect(fetch).toHaveBeenCalledWith(
        'https://custom-llm.example.com/chat/completions',
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.anything(),
          }),
        }),
      )

      expect(ctx.body).toEqual(mockResponse)
    })

    it('should throw 400 if url parameter is missing', async () => {
      const ctx = createMockContext({
        messages: [{role: 'user', content: 'Hello'}],
      })

      await expect(CustomLLMController.chatCompletions(ctx)).rejects.toThrow('URL parameter is required')

      expect(ctx.throw).toHaveBeenCalledWith(400, 'URL parameter is required')
    })

    it('should throw error when custom LLM returns error', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: jest.fn().mockResolvedValue('Invalid API key'),
      })

      const ctx = createMockContext(
        {
          url: 'https://custom-llm.example.com',
          messages: [{role: 'user', content: 'Hello'}],
        },
        'Bearer invalid-key',
      )

      await expect(CustomLLMController.chatCompletions(ctx)).rejects.toThrow('Invalid API key')

      expect(ctx.throw).toHaveBeenCalledWith(401, 'Invalid API key')
    })

    it('should handle connection errors with 503', async () => {
      fetch.mockRejectedValue({
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      })

      const ctx = createMockContext({
        url: 'https://unreachable.example.com',
        messages: [{role: 'user', content: 'Hello'}],
      })

      await expect(CustomLLMController.chatCompletions(ctx)).rejects.toThrow('Connection refused')

      expect(ctx.throw).toHaveBeenCalledWith(503, 'Connection refused')
    })
  })

  describe('embeddings', () => {
    it('should proxy embeddings request to custom LLM', async () => {
      const mockResponse = {
        data: [{embedding: [0.1, 0.2, 0.3], index: 0}],
        usage: {prompt_tokens: 5},
      }

      fetch.mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify(mockResponse)),
      })

      const ctx = createMockContext(
        {
          url: 'https://custom-llm.example.com',
          input: ['Hello', 'World'],
        },
        'Bearer test-api-key',
      )

      await CustomLLMController.embeddings(ctx)

      expect(fetch).toHaveBeenCalledWith(
        'https://custom-llm.example.com/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            Authorization: 'Bearer test-api-key',
          },
          body: JSON.stringify({
            input: ['Hello', 'World'],
          }),
        }),
      )

      expect(ctx.body).toEqual(mockResponse)
    })

    it('should throw 400 if url parameter is missing', async () => {
      const ctx = createMockContext({
        input: ['Hello'],
      })

      await expect(CustomLLMController.embeddings(ctx)).rejects.toThrow('URL parameter is required')

      expect(ctx.throw).toHaveBeenCalledWith(400, 'URL parameter is required')
    })

    it('should handle embeddings service errors', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: jest.fn().mockResolvedValue('Rate limit exceeded'),
      })

      const ctx = createMockContext({
        url: 'https://custom-llm.example.com',
        input: ['Test'],
      })

      await expect(CustomLLMController.embeddings(ctx)).rejects.toThrow('Rate limit exceeded')

      expect(ctx.throw).toHaveBeenCalledWith(429, 'Rate limit exceeded')
    })
  })
})

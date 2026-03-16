import OpenAIController from './OpenAIController'
import {container} from '../../services/container'

jest.mock('../../services/container')

const createMockContext = (requestBody = {}, authHeader = null) => {
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

describe('OpenAIController', () => {
  let mockOpenAIService

  beforeEach(() => {
    jest.clearAllMocks()
    mockOpenAIService = {
      checkApiKey: jest.fn(),
      chatCompletion: jest.fn(),
      embeddings: jest.fn(),
      dalleGenerations: jest.fn(),
    }
    container.get = jest.fn().mockReturnValue(mockOpenAIService)
  })

  describe('chatCompletions', () => {
    it('should return chat completion response with user model', async () => {
      const mockResponse = {
        choices: [{message: {role: 'assistant', content: 'Hello World'}}],
        usage: {prompt_tokens: 10, completion_tokens: 5},
      }

      mockOpenAIService.chatCompletion.mockResolvedValue(mockResponse)

      const ctx = createMockContext(
        {
          messages: [{role: 'user', content: 'Hello'}],
          model: 'gpt-4',
          temperature: 0.7,
        },
        'Bearer test-api-key',
      )

      await OpenAIController.chatCompletions(ctx)

      expect(mockOpenAIService.chatCompletion).toHaveBeenCalledWith([{role: 'user', content: 'Hello'}], 'gpt-4', {
        temperature: 0.7,
      })
      expect(ctx.body).toEqual(mockResponse)
    })

    it('should use configured API key when user key is empty', async () => {
      mockOpenAIService.checkApiKey.mockReturnValue(true)
      mockOpenAIService.chatCompletion.mockResolvedValue({
        choices: [{message: {content: 'Success'}}],
      })

      const ctx = createMockContext(
        {
          messages: [{role: 'user', content: 'Test'}],
          model: 'gpt-4',
        },
        'Bearer EMPTY',
      )

      await OpenAIController.chatCompletions(ctx)

      expect(mockOpenAIService.checkApiKey).toHaveBeenCalled()
      expect(mockOpenAIService.chatCompletion).toHaveBeenCalled()
    })

    it('should throw 401 when both user and configured API keys are missing', async () => {
      mockOpenAIService.checkApiKey.mockReturnValue(false)

      const ctx = createMockContext(
        {
          messages: [{role: 'user', content: 'Test'}],
          model: 'gpt-4',
        },
        'Bearer EMPTY',
      )

      await expect(OpenAIController.chatCompletions(ctx)).rejects.toThrow('OpenAI api key not found')

      expect(ctx.throw).toHaveBeenCalledWith(401, 'OpenAI api key not found')
    })

    it('should throw 400 when model name is missing', async () => {
      const ctx = createMockContext(
        {
          messages: [{role: 'user', content: 'Test'}],
          model: null,
        },
        'Bearer test-api-key',
      )

      await expect(OpenAIController.chatCompletions(ctx)).rejects.toThrow('Model name not specified')

      expect(ctx.throw).toHaveBeenCalledWith(400, 'Model name not specified')
    })

    it('should throw 400 when messages are missing', async () => {
      const ctx = createMockContext(
        {
          model: 'gpt-4',
        },
        'Bearer test-api-key',
      )

      await expect(OpenAIController.chatCompletions(ctx)).rejects.toThrow('Message not specified')

      expect(ctx.throw).toHaveBeenCalledWith(400, 'Message not specified')
    })

    it('should throw 400 when messages array is empty', async () => {
      const ctx = createMockContext(
        {
          messages: [],
          model: 'gpt-4',
        },
        'Bearer test-api-key',
      )

      await expect(OpenAIController.chatCompletions(ctx)).rejects.toThrow('Message not specified')

      expect(ctx.throw).toHaveBeenCalledWith(400, 'Message not specified')
    })

    it('should throw 400 when first message has no content', async () => {
      const ctx = createMockContext(
        {
          messages: [{role: 'user'}],
          model: 'gpt-4',
        },
        'Bearer test-api-key',
      )

      await expect(OpenAIController.chatCompletions(ctx)).rejects.toThrow('Message not specified')

      expect(ctx.throw).toHaveBeenCalledWith(400, 'Message not specified')
    })

    it('should handle OpenAI v6 APIError with error.status', async () => {
      const apiError = new Error('Rate limit exceeded')
      apiError.status = 429

      mockOpenAIService.chatCompletion.mockRejectedValue(apiError)

      const ctx = createMockContext(
        {
          messages: [{role: 'user', content: 'Test'}],
          model: 'gpt-4',
        },
        'Bearer test-api-key',
      )

      await expect(OpenAIController.chatCompletions(ctx)).rejects.toThrow('Rate limit exceeded')

      expect(ctx.throw).toHaveBeenCalledWith(429, 'Rate limit exceeded')
    })

    it('should handle legacy error.response.status format', async () => {
      const legacyError = new Error('Unauthorized')
      legacyError.response = {status: 401}

      mockOpenAIService.chatCompletion.mockRejectedValue(legacyError)

      const ctx = createMockContext(
        {
          messages: [{role: 'user', content: 'Test'}],
          model: 'gpt-4',
        },
        'Bearer test-api-key',
      )

      await expect(OpenAIController.chatCompletions(ctx)).rejects.toThrow('Unauthorized')

      expect(ctx.throw).toHaveBeenCalledWith(401, 'Unauthorized')
    })

    it('should default to 500 when error has no status field', async () => {
      const genericError = new Error('Unknown error')

      mockOpenAIService.chatCompletion.mockRejectedValue(genericError)

      const ctx = createMockContext(
        {
          messages: [{role: 'user', content: 'Test'}],
          model: 'gpt-4',
        },
        'Bearer test-api-key',
      )

      await expect(OpenAIController.chatCompletions(ctx)).rejects.toThrow('Unknown error')

      expect(ctx.throw).toHaveBeenCalledWith(500, 'Unknown error')
    })
  })

  describe('checkOpenaiApiKey', () => {
    it('should return success true when API key is configured', () => {
      mockOpenAIService.checkApiKey.mockReturnValue(true)

      const ctx = {}

      OpenAIController.checkOpenaiApiKey(ctx)

      expect(ctx.body).toEqual({success: true})
    })

    it('should return success false when API key is not configured', () => {
      mockOpenAIService.checkApiKey.mockReturnValue(false)

      const ctx = {}

      OpenAIController.checkOpenaiApiKey(ctx)

      expect(ctx.body).toEqual({success: false})
    })
  })

  describe('embeddings', () => {
    it('should return embeddings response', async () => {
      const mockResponse = {
        object: 'list',
        data: [
          {object: 'embedding', index: 0, embedding: [0.1, 0.2, 0.3]},
          {object: 'embedding', index: 1, embedding: [0.4, 0.5, 0.6]},
        ],
        usage: {prompt_tokens: 10},
      }

      mockOpenAIService.embeddings.mockResolvedValue(mockResponse)

      const ctx = createMockContext(
        {
          input: ['Hello', 'World'],
          model: 'text-embedding-ada-002',
        },
        'Bearer test-api-key',
      )

      await OpenAIController.embeddings(ctx)

      expect(mockOpenAIService.embeddings).toHaveBeenCalledWith(['Hello', 'World'], 'text-embedding-ada-002')
      expect(ctx.body).toEqual(mockResponse)
    })

    it('should throw 401 when API key is missing', async () => {
      mockOpenAIService.checkApiKey.mockReturnValue(false)

      const ctx = createMockContext(
        {
          input: ['Test'],
          model: 'text-embedding-ada-002',
        },
        'Bearer EMPTY',
      )

      await expect(OpenAIController.embeddings(ctx)).rejects.toThrow('OpenAI api key not found')

      expect(ctx.throw).toHaveBeenCalledWith(401, 'OpenAI api key not found')
    })

    it('should throw 400 when model is missing', async () => {
      const ctx = createMockContext(
        {
          input: ['Test'],
          model: null,
        },
        'Bearer test-api-key',
      )

      await expect(OpenAIController.embeddings(ctx)).rejects.toThrow('Model name not specified')

      expect(ctx.throw).toHaveBeenCalledWith(400, 'Model name not specified')
    })

    it('should throw 400 when input is missing', async () => {
      const ctx = createMockContext(
        {
          model: 'text-embedding-ada-002',
        },
        'Bearer test-api-key',
      )

      await expect(OpenAIController.embeddings(ctx)).rejects.toThrow('Input not specified')

      expect(ctx.throw).toHaveBeenCalledWith(400, 'Input not specified')
    })

    it('should handle OpenAI v6 error with error.status', async () => {
      const apiError = new Error('Invalid model')
      apiError.status = 400

      mockOpenAIService.embeddings.mockRejectedValue(apiError)

      const ctx = createMockContext(
        {
          input: ['Test'],
          model: 'invalid-model',
        },
        'Bearer test-api-key',
      )

      await expect(OpenAIController.embeddings(ctx)).rejects.toThrow('Invalid model')

      expect(ctx.throw).toHaveBeenCalledWith(400, 'Invalid model')
    })

    it('should handle legacy error.response.status format', async () => {
      const legacyError = new Error('Rate limit')
      legacyError.response = {status: 429}

      mockOpenAIService.embeddings.mockRejectedValue(legacyError)

      const ctx = createMockContext(
        {
          input: ['Test'],
          model: 'text-embedding-ada-002',
        },
        'Bearer test-api-key',
      )

      await expect(OpenAIController.embeddings(ctx)).rejects.toThrow('Rate limit')

      expect(ctx.throw).toHaveBeenCalledWith(429, 'Rate limit')
    })
  })

  describe('dalleGenerations', () => {
    it('should generate image and return response', async () => {
      const mockResponse = {
        created: 1234567890,
        data: [
          {
            url: 'https://example.com/generated-image.png',
          },
        ],
      }

      mockOpenAIService.dalleGenerations.mockResolvedValue(mockResponse)

      const ctx = createMockContext(
        {
          prompt: 'A beautiful sunset',
          n: 1,
          size: '1024x1024',
          response_format: 'url',
        },
        'Bearer test-api-key',
      )

      await OpenAIController.dalleGenerations(ctx)

      expect(mockOpenAIService.dalleGenerations).toHaveBeenCalledWith('A beautiful sunset', 1, '1024x1024', 'url')
      expect(ctx.body).toEqual(mockResponse)
    })

    it('should generate multiple images', async () => {
      const mockResponse = {
        created: 1234567890,
        data: [{url: 'https://example.com/image1.png'}, {url: 'https://example.com/image2.png'}],
      }

      mockOpenAIService.dalleGenerations.mockResolvedValue(mockResponse)

      const ctx = createMockContext(
        {
          prompt: 'Test prompt',
          n: 2,
          size: '512x512',
          response_format: 'url',
        },
        'Bearer test-api-key',
      )

      await OpenAIController.dalleGenerations(ctx)

      expect(mockOpenAIService.dalleGenerations).toHaveBeenCalledWith('Test prompt', 2, '512x512', 'url')
      expect(ctx.body.data).toHaveLength(2)
    })

    it('should generate b64_json format', async () => {
      const mockResponse = {
        created: 1234567890,
        data: [{b64_json: 'base64encodedimage'}],
      }

      mockOpenAIService.dalleGenerations.mockResolvedValue(mockResponse)

      const ctx = createMockContext(
        {
          prompt: 'Test',
          response_format: 'b64_json',
        },
        'Bearer test-api-key',
      )

      await OpenAIController.dalleGenerations(ctx)

      expect(mockOpenAIService.dalleGenerations).toHaveBeenCalledWith('Test', undefined, undefined, 'b64_json')
    })

    it('should throw 401 when API key is missing', async () => {
      mockOpenAIService.checkApiKey.mockReturnValue(false)

      const ctx = createMockContext(
        {
          prompt: 'Test image',
        },
        'Bearer EMPTY',
      )

      await expect(OpenAIController.dalleGenerations(ctx)).rejects.toThrow('OpenAI api key not found')

      expect(ctx.throw).toHaveBeenCalledWith(401, 'OpenAI api key not found')
    })

    it('should throw 400 when prompt is missing', async () => {
      const ctx = createMockContext({}, 'Bearer test-api-key')

      await expect(OpenAIController.dalleGenerations(ctx)).rejects.toThrow('Input not specified')

      expect(ctx.throw).toHaveBeenCalledWith(400, 'Input not specified')
    })

    it('should handle OpenAI v6 APIError with error.status (critical production path)', async () => {
      const apiError = new Error('Content policy violation')
      apiError.status = 400

      mockOpenAIService.dalleGenerations.mockRejectedValue(apiError)

      const ctx = createMockContext(
        {
          prompt: 'Inappropriate content',
        },
        'Bearer test-api-key',
      )

      await expect(OpenAIController.dalleGenerations(ctx)).rejects.toThrow('Content policy violation')

      expect(ctx.throw).toHaveBeenCalledWith(400, 'Content policy violation')
    })

    it('should handle rate limit errors with correct status code', async () => {
      const rateLimitError = new Error('Rate limit exceeded')
      rateLimitError.status = 429

      mockOpenAIService.dalleGenerations.mockRejectedValue(rateLimitError)

      const ctx = createMockContext(
        {
          prompt: 'Test',
        },
        'Bearer test-api-key',
      )

      await expect(OpenAIController.dalleGenerations(ctx)).rejects.toThrow('Rate limit exceeded')

      expect(ctx.throw).toHaveBeenCalledWith(429, 'Rate limit exceeded')
    })

    it('should handle authentication errors with correct status code', async () => {
      const authError = new Error('Invalid API key')
      authError.status = 401

      mockOpenAIService.dalleGenerations.mockRejectedValue(authError)

      const ctx = createMockContext(
        {
          prompt: 'Test',
        },
        'Bearer invalid-key',
      )

      await expect(OpenAIController.dalleGenerations(ctx)).rejects.toThrow('Invalid API key')

      expect(ctx.throw).toHaveBeenCalledWith(401, 'Invalid API key')
    })

    it('should handle legacy error.response.status format for backward compatibility', async () => {
      const legacyError = new Error('Server error')
      legacyError.response = {status: 503}

      mockOpenAIService.dalleGenerations.mockRejectedValue(legacyError)

      const ctx = createMockContext(
        {
          prompt: 'Test',
        },
        'Bearer test-api-key',
      )

      await expect(OpenAIController.dalleGenerations(ctx)).rejects.toThrow('Server error')

      expect(ctx.throw).toHaveBeenCalledWith(503, 'Server error')
    })

    it('should default to 500 for unknown errors', async () => {
      const unknownError = new Error('Network timeout')

      mockOpenAIService.dalleGenerations.mockRejectedValue(unknownError)

      const ctx = createMockContext(
        {
          prompt: 'Test',
        },
        'Bearer test-api-key',
      )

      await expect(OpenAIController.dalleGenerations(ctx)).rejects.toThrow('Network timeout')

      expect(ctx.throw).toHaveBeenCalledWith(500, 'Network timeout')
    })
  })
})

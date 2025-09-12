import fetch from 'node-fetch'
import ClaudeController from '../ClaudeController'

jest.mock('node-fetch', () => jest.fn())

describe('ClaudeController.sendMessages', () => {
  beforeEach(() => {
    fetch.mockClear()
  })

  it('should return 400 if API key is missing', async () => {
    const ctx = {
      state: {userId: 'user123'},
      headers: {},
      request: {json: jest.fn().mockResolvedValue({model: 'claude-model', messages: [{content: 'Hello'}]})},
      throw: jest.fn(),
    }

    const mockApiResponse = {status: 400}
    fetch.mockResolvedValue({
      ok: false,
      json: jest.fn().mockResolvedValue(mockApiResponse),
    })

    await ClaudeController.sendMessages(ctx)

    expect(ctx.throw).toHaveBeenCalledWith(400, 'Claude API key not found')
  })

  it('should return 400 if model is missing', async () => {
    const ctx = {
      state: {userId: 'userId'},
      headers: {'x-api-key': 'apiKey'},
      request: {json: jest.fn().mockResolvedValue({messages: [{content: 'Hello'}]})},
      throw: jest.fn(),
    }

    const mockApiResponse = {status: 400}
    fetch.mockResolvedValue({
      ok: false,
      json: jest.fn().mockResolvedValue(mockApiResponse),
    })

    await ClaudeController.sendMessages(ctx)

    expect(ctx.throw).toHaveBeenCalledWith(400, 'Model name not specified')
  })

  it('should return 400 if messages are missing or invalid', async () => {
    const ctx = {
      state: {userId: 'userId'},
      headers: {'x-api-key': 'apiKey'},
      request: {json: jest.fn().mockResolvedValue({model: 'claude-model'})},
      throw: jest.fn(),
    }

    const mockApiResponse = {status: 400}
    fetch.mockResolvedValue({
      ok: false,
      json: jest.fn().mockResolvedValue(mockApiResponse),
    })

    await ClaudeController.sendMessages(ctx)

    expect(ctx.throw).toHaveBeenCalledWith(400, 'Messages not specified')
  })

  it('should make a successful request to the Claude API and return response', async () => {
    const mockApiResponse = {
      content: [
        {
          text: 'Hi! My name is Claude.',
          type: 'text',
        },
      ],
      id: 'msg_013Zva2CMHLNnXjNJJKqJ2EF',
      model: 'claude-3-5-sonnet-20241022',
      role: 'assistant',
      stop_reason: 'end_turn',
      stop_sequence: null,
      type: 'message',
      usage: {
        input_tokens: 2095,
        output_tokens: 503,
      },
    }
    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockApiResponse),
    })

    const ctx = {
      state: {userId: 'userId'},
      headers: {'x-api-key': 'apiKey'},
      request: {
        json: jest
          .fn()
          .mockResolvedValue({model: 'claude-model', messages: [{content: 'Hello, Claude!'}], max_tokens: 200}),
      },
      throw: jest.fn(),
      body: null,
    }

    await ClaudeController.sendMessages(ctx)

    expect(ctx.body).toEqual(mockApiResponse)
    expect(ctx.throw).not.toHaveBeenCalled()
  })

  it('should handle 500 errors if there is an unexpected error in response', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: jest.fn().mockRejectedValueOnce({}),
    })

    const ctx = {
      state: {userId: 'userId'},
      headers: {'x-api-key': 'apiKey'},
      request: {
        json: jest
          .fn()
          .mockResolvedValue({model: 'claude-model', messages: [{content: 'Hello, Claude!'}], max_tokens: 2}),
      },
      throw: jest.fn(),
      body: null,
    }

    await ClaudeController.sendMessages(ctx)

    expect(ctx.throw).toHaveBeenCalledWith(500, expect.anything())
  })
})

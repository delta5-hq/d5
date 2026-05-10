import {ServiceContainer} from '../container'

const mockFetch = jest.fn()

jest.mock('node-fetch', () => ({
  __esModule: true,
  default: mockFetch,
}))

describe('ServiceContainer', () => {
  let container
  let mockConfig

  beforeEach(() => {
    jest.clearAllMocks()
    mockConfig = {
      mode: {isE2EMode: false},
      claude: {
        baseUrl: 'https://api.anthropic.com/v1',
        apiKey: 'system-claude-key',
        version: '2023-06-01',
      },
      yandex: {
        baseUrl: 'https://llm.api.cloud.yandex.net',
        apiKey: 'system-yandex-key',
        folderId: 'system-folder-id',
      },
      email: {},
      thumbnail: {},
      perplexity: {},
      midjourney: {},
      zoom: {},
      freepik: {},
      webScraper: {},
      openai: {},
    }
    container = new ServiceContainer(mockConfig)
  })

  describe('RealClaudeService', () => {
    let claudeService

    const successResponse = () =>
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({content: [{text: 'response'}]}),
      })

    const errorResponse = (status, message) =>
      mockFetch.mockResolvedValue({
        ok: false,
        status,
        json: async () => ({error: {message}}),
      })

    const minimalBody = (extra = {}) => ({
      model: 'claude-3-5-sonnet-20241022',
      messages: [{role: 'user', content: 'test'}],
      max_tokens: 100,
      ...extra,
    })

    beforeEach(() => {
      claudeService = container.get('claudeService')
    })

    describe('API key precedence', () => {
      it('uses user-provided apiKey in x-api-key header', async () => {
        successResponse()
        await claudeService.sendMessages(minimalBody({apiKey: 'user-claude-key'}))
        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({headers: expect.objectContaining({'x-api-key': 'user-claude-key'})}),
        )
      })

      it('falls back to system apiKey when body.apiKey is absent', async () => {
        successResponse()
        await claudeService.sendMessages(minimalBody())
        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({headers: expect.objectContaining({'x-api-key': 'system-claude-key'})}),
        )
      })

      it('falls back to system apiKey when body.apiKey is an empty string', async () => {
        successResponse()
        await claudeService.sendMessages(minimalBody({apiKey: ''}))
        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({headers: expect.objectContaining({'x-api-key': 'system-claude-key'})}),
        )
      })
    })

    describe('request construction', () => {
      it('sends to the configured messages endpoint', async () => {
        successResponse()
        await claudeService.sendMessages(minimalBody())
        expect(mockFetch).toHaveBeenCalledWith('https://api.anthropic.com/v1/messages', expect.any(Object))
      })

      it('includes the anthropic-version header', async () => {
        successResponse()
        await claudeService.sendMessages(minimalBody())
        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({'anthropic-version': '2023-06-01'}),
          }),
        )
      })
    })

    describe('error propagation', () => {
      it('throws with API error message when response is not ok', async () => {
        errorResponse(401, 'Invalid API key')
        await expect(claudeService.sendMessages(minimalBody())).rejects.toThrow(
          'Claude API error (401): Invalid API key',
        )
      })

      it('throws with fallback message when API error body has no message field', async () => {
        mockFetch.mockResolvedValue({ok: false, status: 500, json: async () => ({})})
        await expect(claudeService.sendMessages(minimalBody())).rejects.toThrow(
          'Claude API error (500): Unknown error from Claude API',
        )
      })
    })
  })

  describe('RealYandexService', () => {
    let yandexService

    const completionSuccessResponse = () =>
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({alternatives: [{message: {text: 'response'}}]}),
      })

    const embeddingsSuccessResponse = () =>
      mockFetch.mockResolvedValue({ok: true, json: async () => ({embedding: [0.1, 0.2]})})

    const yandexErrorResponse = status => mockFetch.mockResolvedValue({ok: false, status, json: async () => ({})})

    beforeEach(() => {
      yandexService = container.get('yandexService')
    })

    describe('completion — API key and folderId precedence', () => {
      it('uses user-provided apiKey and folderId in Authorization and x-folder-id headers', async () => {
        completionSuccessResponse()
        await yandexService.completion({
          apiKey: 'user-yandex-key',
          folderId: 'user-folder-id',
          model: 'yandexgpt/latest',
          messages: [{role: 'user', text: 'test'}],
        })
        expect(mockFetch).toHaveBeenCalledWith(
          'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer user-yandex-key',
              'x-folder-id': 'user-folder-id',
            }),
          }),
        )
      })

      it('falls back to system credentials when body.apiKey and body.folderId are absent', async () => {
        completionSuccessResponse()
        await yandexService.completion({model: 'yandexgpt/latest', messages: [{role: 'user', text: 'test'}]})
        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer system-yandex-key',
              'x-folder-id': 'system-folder-id',
            }),
          }),
        )
      })
    })

    describe('embeddings — API key and folderId precedence', () => {
      it('uses user-provided apiKey and folderId in Authorization and x-folder-id headers', async () => {
        embeddingsSuccessResponse()
        await yandexService.embeddings({
          apiKey: 'user-yandex-key',
          folderId: 'user-folder-id',
          modelUri: 'emb://folder/model',
          text: 'test',
        })
        expect(mockFetch).toHaveBeenCalledWith(
          'https://llm.api.cloud.yandex.net/foundationModels/v1/textEmbedding',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer user-yandex-key',
              'x-folder-id': 'user-folder-id',
            }),
          }),
        )
      })

      it('falls back to system credentials when body.apiKey and body.folderId are absent', async () => {
        embeddingsSuccessResponse()
        await yandexService.embeddings({modelUri: 'emb://folder/model', text: 'test'})
        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer system-yandex-key',
              'x-folder-id': 'system-folder-id',
            }),
          }),
        )
      })
    })

    describe('error propagation', () => {
      it('throws on non-ok completion response', async () => {
        yandexErrorResponse(403)
        await expect(
          yandexService.completion({model: 'yandexgpt/latest', messages: [{role: 'user', text: 'test'}]}),
        ).rejects.toThrow('Yandex API error: 403')
      })

      it('throws on non-ok embeddings response', async () => {
        yandexErrorResponse(503)
        await expect(yandexService.embeddings({modelUri: 'emb://folder/model', text: 'test'})).rejects.toThrow(
          'Yandex API error: 503',
        )
      })
    })
  })
})

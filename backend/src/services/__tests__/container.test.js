import {ServiceContainer} from '../container'

const mockFetch = jest.fn()

jest.mock('node-fetch', () => ({
  __esModule: true,
  default: mockFetch,
}))

describe('ServiceContainer API Key Passthrough', () => {
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

    beforeEach(() => {
      claudeService = container.get('claudeService')
    })

    it('should use user apiKey when provided in body', async () => {
      const userApiKey = 'user-claude-key'
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({content: [{text: 'response'}]}),
      })

      await claudeService.sendMessages({
        apiKey: userApiKey,
        model: 'claude-3-5-sonnet-20241022',
        messages: [{role: 'user', content: 'test'}],
        max_tokens: 100,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': userApiKey,
          }),
        }),
      )
    })

    it('should fallback to system apiKey when not provided in body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({content: [{text: 'response'}]}),
      })

      await claudeService.sendMessages({
        model: 'claude-3-5-sonnet-20241022',
        messages: [{role: 'user', content: 'test'}],
        max_tokens: 100,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': 'system-claude-key',
          }),
        }),
      )
    })
  })

  describe('RealYandexService', () => {
    let yandexService

    beforeEach(() => {
      yandexService = container.get('yandexService')
    })

    it('should use user apiKey and folderId when provided in body for completion', async () => {
      const userApiKey = 'user-yandex-key'
      const userFolderId = 'user-folder-id'
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({alternatives: [{message: {text: 'response'}}]}),
      })

      await yandexService.completion({
        apiKey: userApiKey,
        folderId: userFolderId,
        model: 'yandexgpt/latest',
        messages: [{role: 'user', text: 'test'}],
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${userApiKey}`,
            'x-folder-id': userFolderId,
          }),
        }),
      )
    })

    it('should fallback to system credentials when not provided in body for completion', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({alternatives: [{message: {text: 'response'}}]}),
      })

      await yandexService.completion({
        model: 'yandexgpt/latest',
        messages: [{role: 'user', text: 'test'}],
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer system-yandex-key',
            'x-folder-id': 'system-folder-id',
          }),
        }),
      )
    })

    it('should use user apiKey and folderId when provided in body for embeddings', async () => {
      const userApiKey = 'user-yandex-key'
      const userFolderId = 'user-folder-id'
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({embedding: [0.1, 0.2]}),
      })

      await yandexService.embeddings({
        apiKey: userApiKey,
        folderId: userFolderId,
        modelUri: 'emb://folder/model',
        text: 'test',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://llm.api.cloud.yandex.net/foundationModels/v1/textEmbedding',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${userApiKey}`,
            'x-folder-id': userFolderId,
          }),
        }),
      )
    })

    it('should fallback to system credentials when not provided in body for embeddings', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({embedding: [0.1, 0.2]}),
      })

      await yandexService.embeddings({
        modelUri: 'emb://folder/model',
        text: 'test',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://llm.api.cloud.yandex.net/foundationModels/v1/textEmbedding',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer system-yandex-key',
            'x-folder-id': 'system-folder-id',
          }),
        }),
      )
    })
  })
})

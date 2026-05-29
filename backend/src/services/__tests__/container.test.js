import {ServiceContainer} from '../container'

const mockFetch = jest.fn()

jest.mock('node-fetch', () => ({
  __esModule: true,
  default: mockFetch,
}))

const okResponse = body => ({ok: true, json: async () => body})
const errorResponse = (status, body = {}) => ({ok: false, status, json: async () => body})

describe('ServiceContainer', () => {
  let container

  beforeEach(() => {
    jest.clearAllMocks()
    container = new ServiceContainer({
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
    })
  })

  describe('RealClaudeService', () => {
    let service
    const basePayload = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [{role: 'user', content: 'hello'}],
      max_tokens: 256,
    }

    beforeEach(() => {
      service = container.get('claudeService')
    })

    describe('authentication — x-api-key header', () => {
      it('uses caller-supplied apiKey when present', async () => {
        mockFetch.mockResolvedValue(okResponse({content: [{type: 'text', text: 'ok'}]}))
        await service.sendMessages({...basePayload, apiKey: 'caller-key'})
        expect(mockFetch.mock.calls[0][1].headers['x-api-key']).toBe('caller-key')
      })

      it('falls back to system apiKey when caller omits apiKey', async () => {
        mockFetch.mockResolvedValue(okResponse({content: [{type: 'text', text: 'ok'}]}))
        await service.sendMessages(basePayload)
        expect(mockFetch.mock.calls[0][1].headers['x-api-key']).toBe('system-claude-key')
      })

      it('falls back to system apiKey when caller passes undefined', async () => {
        mockFetch.mockResolvedValue(okResponse({content: [{type: 'text', text: 'ok'}]}))
        await service.sendMessages({...basePayload, apiKey: undefined})
        expect(mockFetch.mock.calls[0][1].headers['x-api-key']).toBe('system-claude-key')
      })

      it('sends the anthropic-version header from config', async () => {
        mockFetch.mockResolvedValue(okResponse({content: [{type: 'text', text: 'ok'}]}))
        await service.sendMessages(basePayload)
        expect(mockFetch.mock.calls[0][1].headers['anthropic-version']).toBe('2023-06-01')
      })
    })

    describe('request body — wire shape', () => {
      it('forwards model, messages, and max_tokens to the API', async () => {
        mockFetch.mockResolvedValue(okResponse({content: [{type: 'text', text: 'ok'}]}))
        await service.sendMessages(basePayload)
        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body.model).toBe(basePayload.model)
        expect(body.messages).toEqual(basePayload.messages)
        expect(body.max_tokens).toBe(basePayload.max_tokens)
      })

      it('excludes apiKey from the request body', async () => {
        mockFetch.mockResolvedValue(okResponse({content: [{type: 'text', text: 'ok'}]}))
        await service.sendMessages({...basePayload, apiKey: 'caller-key'})
        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body).not.toHaveProperty('apiKey')
      })

      it('excludes userId from the request body', async () => {
        mockFetch.mockResolvedValue(okResponse({content: [{type: 'text', text: 'ok'}]}))
        await service.sendMessages({...basePayload, userId: 'user-123'})
        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body).not.toHaveProperty('userId')
      })

      it('excludes both apiKey and userId when both are supplied', async () => {
        mockFetch.mockResolvedValue(okResponse({content: [{type: 'text', text: 'ok'}]}))
        await service.sendMessages({...basePayload, apiKey: 'caller-key', userId: 'user-123'})
        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body).not.toHaveProperty('apiKey')
        expect(body).not.toHaveProperty('userId')
      })

      it('passes additional Anthropic-native fields (system, temperature) through', async () => {
        mockFetch.mockResolvedValue(okResponse({content: [{type: 'text', text: 'ok'}]}))
        await service.sendMessages({...basePayload, system: 'Be concise.', temperature: 0.5})
        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body.system).toBe('Be concise.')
        expect(body.temperature).toBe(0.5)
      })

      it('sends to the correct Anthropic messages endpoint', async () => {
        mockFetch.mockResolvedValue(okResponse({content: [{type: 'text', text: 'ok'}]}))
        await service.sendMessages(basePayload)
        expect(mockFetch.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages')
      })

      it('uses POST method', async () => {
        mockFetch.mockResolvedValue(okResponse({content: [{type: 'text', text: 'ok'}]}))
        await service.sendMessages(basePayload)
        expect(mockFetch.mock.calls[0][1].method).toBe('POST')
      })
    })

    describe('error handling', () => {
      it('throws with status code and API error message on non-ok response', async () => {
        mockFetch.mockResolvedValue(errorResponse(400, {error: {message: 'apiKey: Extra inputs are not permitted'}}))
        await expect(service.sendMessages(basePayload)).rejects.toThrow(
          'Claude API error (400): apiKey: Extra inputs are not permitted',
        )
      })

      it('throws with generic fallback message when error body has no message', async () => {
        mockFetch.mockResolvedValue(errorResponse(500, {}))
        await expect(service.sendMessages(basePayload)).rejects.toThrow(
          'Claude API error (500): Unknown error from Claude API',
        )
      })

      it('throws on 401 Unauthorized', async () => {
        mockFetch.mockResolvedValue(errorResponse(401, {error: {message: 'Invalid API key'}}))
        await expect(service.sendMessages(basePayload)).rejects.toThrow('Claude API error (401): Invalid API key')
      })
    })
  })

  describe('RealYandexService', () => {
    let service
    const completionPayload = {
      model: 'gpt://folder/yandexgpt/latest',
      messages: [{role: 'user', text: 'hello'}],
    }
    const embeddingsPayload = {
      modelUri: 'emb://folder/text-search-doc/latest',
      text: 'embed this',
    }

    beforeEach(() => {
      service = container.get('yandexService')
    })

    describe('completion — authentication headers', () => {
      it('uses caller-supplied apiKey in Authorization header', async () => {
        mockFetch.mockResolvedValue(okResponse({result: {alternatives: []}}))
        await service.completion({...completionPayload, apiKey: 'caller-yandex-key', folderId: 'caller-folder'})
        expect(mockFetch.mock.calls[0][1].headers['Authorization']).toBe('Api-Key caller-yandex-key')
      })

      it('uses caller-supplied folderId in x-folder-id header', async () => {
        mockFetch.mockResolvedValue(okResponse({result: {alternatives: []}}))
        await service.completion({...completionPayload, apiKey: 'caller-yandex-key', folderId: 'caller-folder'})
        expect(mockFetch.mock.calls[0][1].headers['x-folder-id']).toBe('caller-folder')
      })

      it('falls back to system apiKey when caller omits it', async () => {
        mockFetch.mockResolvedValue(okResponse({result: {alternatives: []}}))
        await service.completion(completionPayload)
        expect(mockFetch.mock.calls[0][1].headers['Authorization']).toBe('Api-Key system-yandex-key')
      })

      it('falls back to system folderId when caller omits it', async () => {
        mockFetch.mockResolvedValue(okResponse({result: {alternatives: []}}))
        await service.completion(completionPayload)
        expect(mockFetch.mock.calls[0][1].headers['x-folder-id']).toBe('system-folder-id')
      })
    })

    describe('completion — wire shape', () => {
      it('excludes apiKey from the request body', async () => {
        mockFetch.mockResolvedValue(okResponse({result: {alternatives: []}}))
        await service.completion({...completionPayload, apiKey: 'caller-key'})
        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body).not.toHaveProperty('apiKey')
      })

      it('excludes folderId from the request body', async () => {
        mockFetch.mockResolvedValue(okResponse({result: {alternatives: []}}))
        await service.completion({...completionPayload, folderId: 'caller-folder'})
        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body).not.toHaveProperty('folderId')
      })

      it('forwards model and messages to the API', async () => {
        mockFetch.mockResolvedValue(okResponse({result: {alternatives: []}}))
        await service.completion(completionPayload)
        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body.model).toBe(completionPayload.model)
        expect(body.messages).toEqual(completionPayload.messages)
      })

      it('sends to the correct Yandex completion endpoint', async () => {
        mockFetch.mockResolvedValue(okResponse({result: {alternatives: []}}))
        await service.completion(completionPayload)
        expect(mockFetch.mock.calls[0][0]).toBe('https://llm.api.cloud.yandex.net/foundationModels/v1/completion')
      })
    })

    describe('completion — error handling', () => {
      it('throws with status code on non-ok response', async () => {
        mockFetch.mockResolvedValue(errorResponse(403))
        await expect(service.completion(completionPayload)).rejects.toThrow('Yandex API error: 403')
      })
    })

    describe('embeddings — authentication headers', () => {
      it('uses caller-supplied apiKey in Authorization header', async () => {
        mockFetch.mockResolvedValue(okResponse({embedding: [0.1, 0.2]}))
        await service.embeddings({...embeddingsPayload, apiKey: 'caller-emb-key', folderId: 'caller-folder'})
        expect(mockFetch.mock.calls[0][1].headers['Authorization']).toBe('Api-Key caller-emb-key')
      })

      it('uses caller-supplied folderId in x-folder-id header', async () => {
        mockFetch.mockResolvedValue(okResponse({embedding: [0.1, 0.2]}))
        await service.embeddings({...embeddingsPayload, apiKey: 'caller-emb-key', folderId: 'caller-folder'})
        expect(mockFetch.mock.calls[0][1].headers['x-folder-id']).toBe('caller-folder')
      })

      it('falls back to system apiKey when caller omits it', async () => {
        mockFetch.mockResolvedValue(okResponse({embedding: [0.1, 0.2]}))
        await service.embeddings(embeddingsPayload)
        expect(mockFetch.mock.calls[0][1].headers['Authorization']).toBe('Api-Key system-yandex-key')
      })

      it('falls back to system folderId when caller omits it', async () => {
        mockFetch.mockResolvedValue(okResponse({embedding: [0.1, 0.2]}))
        await service.embeddings(embeddingsPayload)
        expect(mockFetch.mock.calls[0][1].headers['x-folder-id']).toBe('system-folder-id')
      })
    })

    describe('embeddings — wire shape', () => {
      it('excludes apiKey from the request body', async () => {
        mockFetch.mockResolvedValue(okResponse({embedding: [0.1, 0.2]}))
        await service.embeddings({...embeddingsPayload, apiKey: 'caller-key'})
        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body).not.toHaveProperty('apiKey')
      })

      it('excludes folderId from the request body', async () => {
        mockFetch.mockResolvedValue(okResponse({embedding: [0.1, 0.2]}))
        await service.embeddings({...embeddingsPayload, folderId: 'caller-folder'})
        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body).not.toHaveProperty('folderId')
      })

      it('forwards modelUri and text to the API', async () => {
        mockFetch.mockResolvedValue(okResponse({embedding: [0.1, 0.2]}))
        await service.embeddings(embeddingsPayload)
        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body.modelUri).toBe(embeddingsPayload.modelUri)
        expect(body.text).toBe(embeddingsPayload.text)
      })

      it('sends to the correct Yandex textEmbedding endpoint', async () => {
        mockFetch.mockResolvedValue(okResponse({embedding: [0.1, 0.2]}))
        await service.embeddings(embeddingsPayload)
        expect(mockFetch.mock.calls[0][0]).toBe('https://llm.api.cloud.yandex.net/foundationModels/v1/textEmbedding')
      })
    })

    describe('embeddings — error handling', () => {
      it('throws with status code on non-ok response', async () => {
        mockFetch.mockResolvedValue(errorResponse(401))
        await expect(service.embeddings(embeddingsPayload)).rejects.toThrow('Yandex API error: 401')
      })
    })
  })
})

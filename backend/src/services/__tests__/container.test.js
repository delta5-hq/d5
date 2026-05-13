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

    describe('request body', () => {
      it('does not include apiKey in serialized body', async () => {
        successResponse()
        await claudeService.sendMessages(minimalBody({apiKey: 'user-key'}))
        const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(sentBody).not.toHaveProperty('apiKey')
      })

      it('includes model, messages, and max_tokens in serialized body', async () => {
        successResponse()
        await claudeService.sendMessages(minimalBody())
        const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(sentBody).toMatchObject({
          model: 'claude-3-5-sonnet-20241022',
          messages: [{role: 'user', content: 'test'}],
          max_tokens: 100,
        })
      })

      it('passes optional Anthropic-accepted fields through', async () => {
        successResponse()
        await claudeService.sendMessages(minimalBody({temperature: 0.7, system: 'be concise', top_p: 0.9}))
        const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(sentBody).toMatchObject({temperature: 0.7, system: 'be concise', top_p: 0.9})
      })

      it('strips fields not in the Anthropic allowlist', async () => {
        successResponse()
        await claudeService.sendMessages(minimalBody({internalTag: 'xyz', userId: '123'}))
        const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(sentBody).not.toHaveProperty('internalTag')
        expect(sentBody).not.toHaveProperty('userId')
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
          modelUri: 'gpt://folder/yandexgpt',
          messages: [{role: 'user', text: 'test'}],
        })
        expect(mockFetch).toHaveBeenCalledWith(
          'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Api-Key user-yandex-key',
              'x-folder-id': 'user-folder-id',
            }),
          }),
        )
      })

      it('falls back to system credentials when body.apiKey and body.folderId are absent', async () => {
        completionSuccessResponse()
        await yandexService.completion({modelUri: 'gpt://folder/yandexgpt', messages: [{role: 'user', text: 'test'}]})
        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Api-Key system-yandex-key',
              'x-folder-id': 'system-folder-id',
            }),
          }),
        )
      })
    })

    describe('completion — request body', () => {
      it('serializes only Yandex-accepted fields (modelUri, messages, completionOptions)', async () => {
        completionSuccessResponse()
        await yandexService.completion({
          modelUri: 'gpt://folder/yandexgpt',
          messages: [{role: 'user', text: 'test'}],
          completionOptions: {temperature: 0.5, maxTokens: 200},
          apiKey: 'key',
          folderId: 'folder-id',
        })
        const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(sentBody).toMatchObject({
          modelUri: 'gpt://folder/yandexgpt',
          messages: [{role: 'user', text: 'test'}],
          completionOptions: {temperature: 0.5, maxTokens: 200},
        })
      })

      it('strips apiKey and folderId from request body', async () => {
        completionSuccessResponse()
        await yandexService.completion({
          modelUri: 'gpt://folder/yandexgpt',
          messages: [{role: 'user', text: 'test'}],
          apiKey: 'key',
          folderId: 'folder-id',
        })
        const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(sentBody).not.toHaveProperty('apiKey')
        expect(sentBody).not.toHaveProperty('folderId')
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
              Authorization: 'Api-Key user-yandex-key',
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
              Authorization: 'Api-Key system-yandex-key',
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
          yandexService.completion({modelUri: 'gpt://folder/yandexgpt', messages: [{role: 'user', text: 'test'}]}),
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

  describe('E2E mode (isE2EMode: true) — noop services', () => {
    let e2eContainer

    beforeEach(() => {
      e2eContainer = new ServiceContainer({
        ...mockConfig,
        mode: {isE2EMode: true},
        openai: {apiKey: 'sys-openai-key', defaultModel: 'gpt-4'},
        claude: {
          baseUrl: 'https://api.anthropic.com/v1',
          apiKey: 'sys-claude-key',
          version: '2023-06-01',
          defaultModel: 'claude-3-sonnet-20240229',
        },
        yandex: {
          baseUrl: 'https://llm.api.cloud.yandex.net',
          apiKey: 'sys-yandex-key',
          folderId: 'sys-folder-id',
          defaultModel: 'yandexgpt/latest',
        },
      })
    })

    describe('service selection', () => {
      it('claudeService does not call fetch when E2E mode is active', async () => {
        const svc = e2eContainer.get('claudeService')
        await svc.sendMessages({model: 'claude-3-sonnet', messages: [{role: 'user', content: 'hi'}], max_tokens: 10})
        expect(mockFetch).not.toHaveBeenCalled()
      })

      it('openaiService chatCompletion does not call fetch when E2E mode is active', async () => {
        const svc = e2eContainer.get('openaiService')
        await svc.chatCompletion([{role: 'user', content: 'hi'}], 'gpt-4')
        expect(mockFetch).not.toHaveBeenCalled()
      })

      it('yandexService completion does not call fetch when E2E mode is active', async () => {
        const svc = e2eContainer.get('yandexService')
        await svc.completion({modelUri: 'gpt://folder/yandexgpt', messages: [{role: 'user', text: 'hi'}]})
        expect(mockFetch).not.toHaveBeenCalled()
      })
    })

    describe('NoopClaudeService response contract', () => {
      let claudeSvc

      beforeEach(() => {
        claudeSvc = e2eContainer.get('claudeService')
      })

      it('returns the Anthropic message envelope shape', async () => {
        const result = await claudeSvc.sendMessages({
          model: 'claude-3-sonnet',
          messages: [{role: 'user', content: 'hi'}],
          max_tokens: 10,
        })
        expect(result).toMatchObject({
          type: 'message',
          role: 'assistant',
          content: expect.arrayContaining([expect.objectContaining({type: 'text'})]),
          stop_reason: 'end_turn',
        })
      })

      it('returns fixed text content matching the Go backend noop response', async () => {
        const result = await claudeSvc.sendMessages({
          model: 'claude-3-sonnet',
          messages: [{role: 'user', content: 'hi'}],
          max_tokens: 10,
        })
        expect(result.content[0].text).toBe('Mock response from Claude')
      })

      it('echoes the requested model back in the response', async () => {
        const result = await claudeSvc.sendMessages({
          model: 'claude-3-haiku',
          messages: [{role: 'user', content: 'hi'}],
          max_tokens: 10,
        })
        expect(result.model).toBe('claude-3-haiku')
      })

      it('falls back to configured defaultModel when no model is provided', async () => {
        const result = await claudeSvc.sendMessages({
          messages: [{role: 'user', content: 'hi'}],
          max_tokens: 10,
        })
        expect(result.model).toBe('claude-3-sonnet-20240229')
      })

      it('does not require an apiKey in the request body', async () => {
        await expect(
          claudeSvc.sendMessages({model: 'claude-3-sonnet', messages: [{role: 'user', content: 'hi'}], max_tokens: 10}),
        ).resolves.toBeDefined()
      })
    })

    describe('NoopOpenAIService response contract', () => {
      let openaiSvc

      beforeEach(() => {
        openaiSvc = e2eContainer.get('openaiService')
      })

      it('returns the OpenAI chat completion envelope shape', async () => {
        const result = await openaiSvc.chatCompletion([{role: 'user', content: 'hi'}], 'gpt-4')
        expect(result).toMatchObject({
          object: 'chat.completion',
          choices: expect.arrayContaining([
            expect.objectContaining({message: expect.objectContaining({role: 'assistant'})}),
          ]),
        })
      })

      it('returns fixed text content from the first choice', async () => {
        const result = await openaiSvc.chatCompletion([{role: 'user', content: 'hi'}], 'gpt-4')
        expect(result.choices[0].message.content).toBe('Mock OpenAI response')
      })

      it('echoes the requested model in the response', async () => {
        const result = await openaiSvc.chatCompletion([{role: 'user', content: 'hi'}], 'gpt-3.5-turbo')
        expect(result.model).toBe('gpt-3.5-turbo')
      })

      it('returns embeddings as a list with one entry per input element', async () => {
        const result = await openaiSvc.embeddings(['hello', 'world'], 'text-embedding-ada-002')
        expect(result.object).toBe('list')
        expect(result.data).toHaveLength(2)
      })

      it('embeddings data entries have an embedding array', async () => {
        const result = await openaiSvc.embeddings(['hello'], 'text-embedding-ada-002')
        expect(Array.isArray(result.data[0].embedding)).toBe(true)
        expect(result.data[0].embedding.length).toBeGreaterThan(0)
      })
    })

    describe('NoopYandexService response contract', () => {
      let yandexSvc

      beforeEach(() => {
        yandexSvc = e2eContainer.get('yandexService')
      })

      it('returns the YandexGPT completion envelope shape', async () => {
        const result = await yandexSvc.completion({
          modelUri: 'gpt://folder/yandexgpt',
          messages: [{role: 'user', text: 'hi'}],
        })
        expect(result).toMatchObject({
          result: expect.objectContaining({
            alternatives: expect.arrayContaining([
              expect.objectContaining({message: expect.objectContaining({role: 'assistant'})}),
            ]),
          }),
        })
      })

      it('returns fixed text matching the Go backend noop response', async () => {
        const result = await yandexSvc.completion({
          modelUri: 'gpt://folder/yandexgpt',
          messages: [{role: 'user', text: 'hi'}],
        })
        expect(result.result.alternatives[0].message.text).toBe('Mock response from Yandex')
      })

      it('does not call fetch', async () => {
        await yandexSvc.completion({
          modelUri: 'gpt://folder/yandexgpt',
          messages: [{role: 'user', text: 'hi'}],
        })
        expect(mockFetch).not.toHaveBeenCalled()
      })
    })
  })
})

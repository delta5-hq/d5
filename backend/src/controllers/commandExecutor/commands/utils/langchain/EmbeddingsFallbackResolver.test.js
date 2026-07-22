import {resolveEmbeddingsFallbackType, NATIVE_EMBEDDINGS_TYPES} from './EmbeddingsFallbackResolver'
import {Model} from './IntegrationSettingsLoader'

const NATIVE_PROVIDERS = [Model.OpenAI, Model.Qwen, Model.CustomLLM, Model.YandexGPT]
const NON_NATIVE_PROVIDERS = [Model.Claude, Model.Deepseek]

describe('NATIVE_EMBEDDINGS_TYPES', () => {
  it.each(NATIVE_PROVIDERS)('includes %s as a native embeddings provider', type => {
    expect(NATIVE_EMBEDDINGS_TYPES.has(type)).toBe(true)
  })

  it.each(NON_NATIVE_PROVIDERS)('excludes %s — no native embeddings API', type => {
    expect(NATIVE_EMBEDDINGS_TYPES.has(type)).toBe(false)
  })

  it('is a Set', () => {
    expect(NATIVE_EMBEDDINGS_TYPES).toBeInstanceOf(Set)
  })
})

describe('resolveEmbeddingsFallbackType', () => {
  describe('priority order: OpenAI > Qwen > CustomLLM > YandexGPT', () => {
    it('returns OpenAI when all four providers are configured', () => {
      expect(
        resolveEmbeddingsFallbackType({
          openai: {apiKey: 'sk'},
          qwen: {apiKey: 'qk'},
          custom_llm: {apiRootUrl: 'https://api.example.com'},
          yandex: {apiKey: 'yk', folder_id: 'fid'},
        }),
      ).toBe(Model.OpenAI)
    })

    it('returns Qwen when OpenAI is absent but Qwen, CustomLLM, Yandex are present', () => {
      expect(
        resolveEmbeddingsFallbackType({
          qwen: {apiKey: 'qk'},
          custom_llm: {apiRootUrl: 'https://api.example.com'},
          yandex: {apiKey: 'yk', folder_id: 'fid'},
        }),
      ).toBe(Model.Qwen)
    })

    it('returns CustomLLM when OpenAI and Qwen are absent', () => {
      expect(
        resolveEmbeddingsFallbackType({
          custom_llm: {apiRootUrl: 'https://api.example.com'},
          yandex: {apiKey: 'yk', folder_id: 'fid'},
        }),
      ).toBe(Model.CustomLLM)
    })

    it('returns YandexGPT when it is the only provider configured', () => {
      expect(resolveEmbeddingsFallbackType({yandex: {apiKey: 'yk', folder_id: 'fid'}})).toBe(Model.YandexGPT)
    })
  })

  describe('single-provider isolation', () => {
    it('returns OpenAI when only OpenAI is configured', () => {
      expect(resolveEmbeddingsFallbackType({openai: {apiKey: 'sk'}})).toBe(Model.OpenAI)
    })

    it('returns Qwen when only Qwen is configured', () => {
      expect(resolveEmbeddingsFallbackType({qwen: {apiKey: 'qk'}})).toBe(Model.Qwen)
    })

    it('returns CustomLLM when only CustomLLM is configured', () => {
      expect(resolveEmbeddingsFallbackType({custom_llm: {apiRootUrl: 'https://api.example.com'}})).toBe(Model.CustomLLM)
    })

    it('returns YandexGPT when only YandexGPT is configured', () => {
      expect(resolveEmbeddingsFallbackType({yandex: {apiKey: 'yk', folder_id: 'fid'}})).toBe(Model.YandexGPT)
    })
  })

  describe('credential validation — blank values are treated as absent', () => {
    it.each([null, undefined, '', '   '])('ignores OpenAI when apiKey is %p', invalidKey => {
      const settings = {openai: {apiKey: invalidKey}, qwen: {apiKey: 'qk'}}
      expect(resolveEmbeddingsFallbackType(settings)).toBe(Model.Qwen)
    })

    it.each([null, undefined, '', '   '])('ignores Qwen when apiKey is %p', invalidKey => {
      const settings = {qwen: {apiKey: invalidKey}, custom_llm: {apiRootUrl: 'https://api.example.com'}}
      expect(resolveEmbeddingsFallbackType(settings)).toBe(Model.CustomLLM)
    })

    it.each([null, undefined, '', '   '])('ignores CustomLLM when apiRootUrl is %p', invalidUrl => {
      const settings = {custom_llm: {apiRootUrl: invalidUrl}, yandex: {apiKey: 'yk', folder_id: 'fid'}}
      expect(resolveEmbeddingsFallbackType(settings)).toBe(Model.YandexGPT)
    })

    it('requires both apiKey and folder_id for YandexGPT — missing folder_id is treated as absent', () => {
      expect(() => resolveEmbeddingsFallbackType({yandex: {apiKey: 'yk'}})).toThrow(/No embeddings provider configured/)
    })

    it('requires both apiKey and folder_id for YandexGPT — missing apiKey is treated as absent', () => {
      expect(() => resolveEmbeddingsFallbackType({yandex: {folder_id: 'fid'}})).toThrow(
        /No embeddings provider configured/,
      )
    })

    it('requires both apiKey and folder_id for YandexGPT — blank folder_id is treated as absent', () => {
      expect(() => resolveEmbeddingsFallbackType({yandex: {apiKey: 'yk', folder_id: '  '}})).toThrow(
        /No embeddings provider configured/,
      )
    })
  })

  describe('throws when no embeddings provider is configured', () => {
    it.each([null, undefined, {}])('throws for settings=%p', settings => {
      expect(() => resolveEmbeddingsFallbackType(settings)).toThrow(/No embeddings provider configured/)
    })

    it('throws when all credentials are blank', () => {
      expect(() =>
        resolveEmbeddingsFallbackType({openai: {apiKey: ''}, qwen: {apiKey: '  '}, custom_llm: {apiRootUrl: null}}),
      ).toThrow(/No embeddings provider configured/)
    })

    it('error message lists the supported providers so the user knows what to configure', () => {
      try {
        resolveEmbeddingsFallbackType({})
        expect.fail('should have thrown')
      } catch (e) {
        expect(e.message).toMatch(/OpenAI/)
        expect(e.message).toMatch(/Qwen/)
        expect(e.message).toMatch(/Settings.*Integrations/i)
      }
    })
  })

  describe('non-native-embeddings provider keys in settings are irrelevant to selection', () => {
    it.each(NON_NATIVE_PROVIDERS)(
      '%s credentials in settings are ignored — selection is driven by native providers only',
      nonNativeType => {
        const providerKey = nonNativeType.toLowerCase()
        const settings = {[providerKey]: {apiKey: 'sk'}, openai: {apiKey: 'sk-openai'}}
        expect(resolveEmbeddingsFallbackType(settings)).toBe(Model.OpenAI)
      },
    )

    it('Deepseek credentials alone do not qualify — falls through to Qwen', () => {
      expect(resolveEmbeddingsFallbackType({deepseek: {apiKey: 'sk'}, qwen: {apiKey: 'qk'}})).toBe(Model.Qwen)
    })
  })
})

import {EmbStorageType} from '../../../../../shared/config/constants'
import {determineLLMType, getEmbeddings, Model} from './getLLM'

describe('determineLLMType', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('explicit model selection (highest priority)', () => {
    it.each([[Model.OpenAI], [Model.Claude], [Model.Qwen], [Model.Deepseek], [Model.YandexGPT], [Model.CustomLLM]])(
      'returns %s when explicitly set',
      model => {
        const settings = {model}
        expect(determineLLMType(undefined, settings)).toBe(model)
      },
    )

    it('ignores credentials when model explicitly set', () => {
      const settings = {
        model: Model.Claude,
        openai: {apiKey: 'openai-key'},
        qwen: {apiKey: 'qwen-key'},
      }
      expect(determineLLMType(undefined, settings)).toBe(Model.Claude)
    })

    it('ignores lang when model explicitly set', () => {
      const settings = {
        model: Model.Claude,
        lang: 'ru',
      }
      expect(determineLLMType(undefined, settings)).toBe(Model.Claude)
    })

    it('ignores command --lang when model explicitly set', () => {
      const settings = {model: Model.Claude}
      expect(determineLLMType('/web prompt --lang=ru', settings)).toBe(Model.Claude)
    })
  })

  describe('language-based selection (second priority)', () => {
    it('returns YandexGPT when lang=ru in settings', () => {
      const settings = {lang: 'ru'}
      expect(determineLLMType(undefined, settings)).toBe(Model.YandexGPT)
    })

    it('returns OpenAI when lang is not ru in settings', () => {
      const settings = {lang: 'en'}
      expect(determineLLMType(undefined, settings)).toBe(Model.OpenAI)
    })

    it('returns YandexGPT when command has --lang=ru flag', () => {
      expect(determineLLMType('/web prompt --lang=ru', {})).toBe(Model.YandexGPT)
    })

    it('prefers settings lang over credentials', () => {
      const settings = {
        lang: 'ru',
        claude: {apiKey: 'claude-key'},
      }
      expect(determineLLMType(undefined, settings)).toBe(Model.YandexGPT)
    })

    it('prefers command --lang over credentials', () => {
      const settings = {
        claude: {apiKey: 'claude-key'},
      }
      expect(determineLLMType('/web prompt --lang=ru', settings)).toBe(Model.YandexGPT)
    })
  })

  describe('credential-based auto-detection (third priority)', () => {
    describe('single provider configured', () => {
      it.each([
        ['openai', 'apiKey', Model.OpenAI],
        ['claude', 'apiKey', Model.Claude],
        ['qwen', 'apiKey', Model.Qwen],
        ['deepseek', 'apiKey', Model.Deepseek],
        ['custom_llm', 'apiRootUrl', Model.CustomLLM],
        ['yandex', 'apiKey', Model.YandexGPT],
      ])('detects %s when only %s configured', (providerKey, credentialKey, expected) => {
        const settings = {
          model: 'auto',
          [providerKey]: {[credentialKey]: 'test-credential'},
        }
        expect(determineLLMType(undefined, settings)).toBe(expected)
      })
    })

    describe('provider priority order', () => {
      it('prefers OpenAI over all others', () => {
        const settings = {
          model: 'auto',
          openai: {apiKey: 'openai-key'},
          claude: {apiKey: 'claude-key'},
          qwen: {apiKey: 'qwen-key'},
          deepseek: {apiKey: 'deepseek-key'},
          custom_llm: {apiRootUrl: 'http://localhost:8080'},
          yandex: {apiKey: 'yandex-key'},
        }
        expect(determineLLMType(undefined, settings)).toBe(Model.OpenAI)
      })

      it('prefers Claude over Qwen, Deepseek, CustomLLM, Yandex', () => {
        const settings = {
          model: 'auto',
          claude: {apiKey: 'claude-key'},
          qwen: {apiKey: 'qwen-key'},
          deepseek: {apiKey: 'deepseek-key'},
          custom_llm: {apiRootUrl: 'http://localhost:8080'},
          yandex: {apiKey: 'yandex-key'},
        }
        expect(determineLLMType(undefined, settings)).toBe(Model.Claude)
      })

      it('prefers Qwen over Deepseek, CustomLLM, Yandex', () => {
        const settings = {
          model: 'auto',
          qwen: {apiKey: 'qwen-key'},
          deepseek: {apiKey: 'deepseek-key'},
          custom_llm: {apiRootUrl: 'http://localhost:8080'},
          yandex: {apiKey: 'yandex-key'},
        }
        expect(determineLLMType(undefined, settings)).toBe(Model.Qwen)
      })

      it('prefers Deepseek over CustomLLM, Yandex', () => {
        const settings = {
          model: 'auto',
          deepseek: {apiKey: 'deepseek-key'},
          custom_llm: {apiRootUrl: 'http://localhost:8080'},
          yandex: {apiKey: 'yandex-key'},
        }
        expect(determineLLMType(undefined, settings)).toBe(Model.Deepseek)
      })

      it('prefers CustomLLM over Yandex', () => {
        const settings = {
          model: 'auto',
          custom_llm: {apiRootUrl: 'http://localhost:8080'},
          yandex: {apiKey: 'yandex-key'},
        }
        expect(determineLLMType(undefined, settings)).toBe(Model.CustomLLM)
      })
    })

    describe('invalid credential handling', () => {
      it('ignores empty provider objects', () => {
        const settings = {
          model: 'auto',
          openai: {},
          claude: {apiKey: 'claude-key'},
        }
        expect(determineLLMType(undefined, settings)).toBe(Model.Claude)
      })

      it('ignores null credentials', () => {
        const settings = {
          model: 'auto',
          openai: {apiKey: null},
          claude: {apiKey: 'claude-key'},
        }
        expect(determineLLMType(undefined, settings)).toBe(Model.Claude)
      })

      it('ignores undefined credentials', () => {
        const settings = {
          model: 'auto',
          openai: {apiKey: undefined},
          claude: {apiKey: 'claude-key'},
        }
        expect(determineLLMType(undefined, settings)).toBe(Model.Claude)
      })

      it('ignores empty string credentials', () => {
        const settings = {
          model: 'auto',
          openai: {apiKey: ''},
          claude: {apiKey: 'claude-key'},
        }
        expect(determineLLMType(undefined, settings)).toBe(Model.Claude)
      })

      it('treats whitespace-only credentials as invalid', () => {
        const settings = {
          model: 'auto',
          openai: {apiKey: '   '},
          claude: {apiKey: 'claude-key'},
        }
        expect(determineLLMType(undefined, settings)).toBe(Model.Claude)
      })
    })
  })

  describe('ultimate fallback (lowest priority)', () => {
    it('returns OpenAI when model=auto and no credentials', () => {
      const settings = {model: 'auto'}
      expect(determineLLMType(undefined, settings)).toBe(Model.OpenAI)
    })

    it('returns OpenAI when settings is empty object', () => {
      expect(determineLLMType('/web prompt', {})).toBe(Model.OpenAI)
    })

    it('returns OpenAI when settings is null', () => {
      expect(determineLLMType('/web prompt', null)).toBe(Model.OpenAI)
    })

    it('returns OpenAI when settings is undefined', () => {
      expect(determineLLMType('/web prompt', undefined)).toBe(Model.OpenAI)
    })

    it('returns OpenAI when command is null and settings is empty', () => {
      expect(determineLLMType(null, {})).toBe(Model.OpenAI)
    })
  })
})

describe('getEmbeddingsSettings', () => {
  it('should return correct config for Openai', () => {
    const OPENAI_API_KEY = 'openai_api_key'
    const result = getEmbeddings({
      type: Model.OpenAI,
      settings: {
        openai: {
          apiKey: OPENAI_API_KEY,
        },
      },
    })

    expect(result.embeddings).toBeDefined()
    expect(result.embeddings.constructor.name).toBe('OpenAIEmbeddings')
    expect(result.chunkSize).toBe(8191)
    expect(result.similarityThreshold).toBe(0.75)
    expect(result.storageType).toBe(EmbStorageType.openai)
  })

  it('should return correct config for CustomLLM', () => {
    const API_URL = 'http://localhost:3000/api'
    const result = getEmbeddings({
      type: Model.CustomLLM,
      settings: {
        custom_llm: {
          apiRootUrl: API_URL,
        },
      },
    })

    expect(result.embeddings).toEqual(
      expect.objectContaining({
        apiRootUrl: API_URL,
      }),
    )
    expect(result.storageType).toBe(EmbStorageType.custom_llm)
  })

  it('should return correct config for Qwen', () => {
    const QWEN_API_KEY = 'qwen_api_key'
    const result = getEmbeddings({
      type: Model.Qwen,
      settings: {
        qwen: {
          apiKey: QWEN_API_KEY,
        },
      },
    })

    expect(result.embeddings).toBeDefined()
    expect(result.embeddings.constructor.name).toBe('OpenAIEmbeddings')
    expect(result.chunkSize).toBe(4096)
    expect(result.similarityThreshold).toBe(0.75)
    expect(result.storageType).toBe(EmbStorageType.qwen)
  })

  it('should return default Yandex config if type not matched', () => {
    const YANDEX_API_KEY = 'yandex_api_key'
    const YANDEX_FOLDER_ID = 'yandex_folder_id'
    const result = getEmbeddings({
      type: Model.YandexGPT,
      settings: {
        yandex: {
          apiKey: YANDEX_API_KEY,
          folder_id: YANDEX_FOLDER_ID,
        },
      },
    })

    expect(result.embeddings).toEqual(
      expect.objectContaining({
        apiKey: YANDEX_API_KEY,
        folderID: YANDEX_FOLDER_ID,
      }),
    )
    expect(result.storageType).toBe(EmbStorageType.yandex)
  })
})

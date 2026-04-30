import {EmbStorageType} from '../../../../../shared/config/constants'
import {determineLLMType, getEmbeddings, getIntegrationSettings, Model} from './getLLM'
import IntegrationFacade from '../../../../../repositories/IntegrationFacade'

jest.mock('../../../../../repositories/IntegrationFacade')

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

describe('getIntegrationSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('throws when integration not found', async () => {
    IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({merged: null, workflowDoc: null})

    await expect(getIntegrationSettings('user-1')).rejects.toThrow('Integration not found')
  })

  it('returns merged settings when workflowId is null', async () => {
    const merged = {userId: 'user-1', workflowId: null, openai: {apiKey: 'sk-key'}, model: 'auto'}
    IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({merged, workflowDoc: null})

    const result = await getIntegrationSettings('user-1', null)

    expect(result).toEqual(merged)
    expect(result.model).toBe('auto')
  })

  it('does not modify model when workflow provider exists but model is explicitly set', async () => {
    const merged = {
      userId: 'user-1',
      workflowId: 'wf-1',
      openai: {apiKey: 'sk-global'},
      claude: {apiKey: 'sk-workflow'},
      model: Model.OpenAI,
    }
    const workflowDoc = {userId: 'user-1', workflowId: 'wf-1', claude: {apiKey: 'sk-workflow'}}

    IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({merged, workflowDoc})

    const result = await getIntegrationSettings('user-1', 'wf-1')

    expect(result.model).toBe(Model.OpenAI)
  })

  describe('workflow-scoped provider detection when model=auto', () => {
    it.each([
      [Model.OpenAI, 'openai', {apiKey: 'sk-workflow'}],
      [Model.Claude, 'claude', {apiKey: 'sk-workflow'}],
      [Model.Qwen, 'qwen', {apiKey: 'sk-workflow'}],
      [Model.Deepseek, 'deepseek', {apiKey: 'sk-workflow'}],
      [Model.YandexGPT, 'yandex', {apiKey: 'sk-workflow'}],
      [Model.CustomLLM, 'custom_llm', {apiRootUrl: 'https://api.custom.com'}],
    ])('sets model to %s when workflow has %s credentials', async (expectedModel, providerKey, credentials) => {
      const merged = {
        userId: 'user-1',
        workflowId: 'wf-1',
        openai: {apiKey: 'sk-global'},
        [providerKey]: credentials,
        model: 'auto',
      }
      const workflowDoc = {userId: 'user-1', workflowId: 'wf-1', [providerKey]: credentials}

      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({merged, workflowDoc})

      const result = await getIntegrationSettings('user-1', 'wf-1')

      expect(result.model).toBe(expectedModel)
    })
  })

  it('does not modify model when workflow doc has no credentials', async () => {
    const merged = {
      userId: 'user-1',
      workflowId: 'wf-1',
      openai: {apiKey: 'sk-global'},
      model: 'auto',
    }
    const workflowDoc = {userId: 'user-1', workflowId: 'wf-1'}

    IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({merged, workflowDoc})

    const result = await getIntegrationSettings('user-1', 'wf-1')

    expect(result.model).toBe('auto')
  })

  it('does not modify model when workflowDoc is null', async () => {
    const merged = {
      userId: 'user-1',
      workflowId: 'wf-1',
      openai: {apiKey: 'sk-global'},
      model: 'auto',
    }

    IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({merged, workflowDoc: null})

    const result = await getIntegrationSettings('user-1', 'wf-1')

    expect(result.model).toBe('auto')
  })

  it('prefers first configured provider in workflow when multiple exist', async () => {
    const merged = {
      userId: 'user-1',
      workflowId: 'wf-1',
      openai: {apiKey: 'sk-workflow-openai'},
      claude: {apiKey: 'sk-workflow-claude'},
      model: 'auto',
    }
    const workflowDoc = {
      userId: 'user-1',
      workflowId: 'wf-1',
      openai: {apiKey: 'sk-workflow-openai'},
      claude: {apiKey: 'sk-workflow-claude'},
    }

    IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({merged, workflowDoc})

    const result = await getIntegrationSettings('user-1', 'wf-1')

    expect(result.model).toBe(Model.OpenAI)
  })

  describe('edge cases', () => {
    it('does not modify model when workflow credential is empty string', async () => {
      const merged = {
        userId: 'user-1',
        workflowId: 'wf-1',
        openai: {apiKey: 'sk-global'},
        claude: {apiKey: ''},
        model: 'auto',
      }
      const workflowDoc = {userId: 'user-1', workflowId: 'wf-1', claude: {apiKey: ''}}

      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({merged, workflowDoc})

      const result = await getIntegrationSettings('user-1', 'wf-1')

      expect(result.model).toBe('auto')
    })

    it('does not modify model when workflow credential is whitespace-only', async () => {
      const merged = {
        userId: 'user-1',
        workflowId: 'wf-1',
        openai: {apiKey: 'sk-global'},
        claude: {apiKey: '   '},
        model: 'auto',
      }
      const workflowDoc = {userId: 'user-1', workflowId: 'wf-1', claude: {apiKey: '   '}}

      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({merged, workflowDoc})

      const result = await getIntegrationSettings('user-1', 'wf-1')

      expect(result.model).toBe('auto')
    })

    it('sets model when workflow provider object exists but with undefined credential', async () => {
      const merged = {
        userId: 'user-1',
        workflowId: 'wf-1',
        openai: {apiKey: 'sk-global'},
        claude: {apiKey: undefined},
        model: 'auto',
      }
      const workflowDoc = {userId: 'user-1', workflowId: 'wf-1', claude: {apiKey: undefined}}

      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({merged, workflowDoc})

      const result = await getIntegrationSettings('user-1', 'wf-1')

      expect(result.model).toBe('auto')
    })

    it('respects sentinel model value from merge', async () => {
      const merged = {
        userId: 'user-1',
        workflowId: 'wf-1',
        claude: {apiKey: 'sk-workflow'},
        model: 'auto',
      }
      const workflowDoc = {userId: 'user-1', workflowId: 'wf-1', claude: {apiKey: 'sk-workflow'}, model: 'auto'}

      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({merged, workflowDoc})

      const result = await getIntegrationSettings('user-1', 'wf-1')

      expect(result.model).toBe(Model.Claude)
    })

    it('preserves explicitly set workflow model over credential detection', async () => {
      const merged = {
        userId: 'user-1',
        workflowId: 'wf-1',
        openai: {apiKey: 'sk-global'},
        claude: {apiKey: 'sk-workflow'},
        model: Model.Qwen,
      }
      const workflowDoc = {userId: 'user-1', workflowId: 'wf-1', claude: {apiKey: 'sk-workflow'}, model: Model.Qwen}

      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({merged, workflowDoc})

      const result = await getIntegrationSettings('user-1', 'wf-1')

      expect(result.model).toBe(Model.Qwen)
    })

    it('does not mutate original merged object when setting model', async () => {
      const merged = {
        userId: 'user-1',
        workflowId: 'wf-1',
        claude: {apiKey: 'sk-workflow'},
        model: 'auto',
      }
      const workflowDoc = {userId: 'user-1', workflowId: 'wf-1', claude: {apiKey: 'sk-workflow'}}

      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({merged, workflowDoc})

      await getIntegrationSettings('user-1', 'wf-1')

      expect(merged.model).toBe(Model.Claude)
    })
  })

  describe('environment variable fallback behavior', () => {
    it('env fallback is applied after merge in getIntegrationSettings', async () => {
      const merged = {userId: 'user-1', workflowId: null, model: 'auto'}
      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({merged, workflowDoc: null})

      const result = await getIntegrationSettings('user-1', null)

      expect(result).toBeDefined()
    })

    it('user credentials take precedence when both user key and env exist in merged settings', async () => {
      const merged = {userId: 'user-1', workflowId: null, claude: {apiKey: 'sk-user-claude'}, model: 'auto'}
      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({merged, workflowDoc: null})

      const result = await getIntegrationSettings('user-1', null)

      expect(result.claude.apiKey).toBe('sk-user-claude')
    })

    it('workflow-scoped key wins over global after merge', async () => {
      const merged = {
        userId: 'user-1',
        workflowId: 'wf-1',
        claude: {apiKey: 'sk-workflow-claude'},
        model: 'auto',
      }
      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
        merged,
        workflowDoc: {userId: 'user-1', workflowId: 'wf-1', claude: {apiKey: 'sk-workflow-claude'}},
      })

      const result = await getIntegrationSettings('user-1', 'wf-1')

      expect(result.claude.apiKey).toBe('sk-workflow-claude')
    })
  })
})

describe('getLLM error handling for missing API keys', () => {
  const {getLLM} = require('./getLLM')

  describe('throws descriptive error when apiKey missing', () => {
    it.each([
      [
        Model.OpenAI,
        {openai: {}},
        'OpenAI API key not configured. Set it in Integration Settings or set the OPENAI_API_KEY environment variable.',
      ],
      [
        Model.Claude,
        {claude: {}},
        'Claude API key not configured. Set it in Integration Settings or set the CLAUDE_API_KEY environment variable.',
      ],
      [
        Model.Qwen,
        {qwen: {}},
        'Qwen API key not configured. Set it in Integration Settings or set the QWEN_API_KEY environment variable.',
      ],
      [
        Model.Deepseek,
        {deepseek: {}},
        'Deepseek API key not configured. Set it in Integration Settings or set the DEEPSEEK_API_KEY environment variable.',
      ],
    ])('throws for %s when apiKey absent', (type, settings, expectedError) => {
      expect(() => getLLM({type, settings})).toThrow(expectedError)
    })

    it('throws for YandexGPT when apiKey absent', () => {
      expect(() => getLLM({type: Model.YandexGPT, settings: {yandex: {folder_id: 'folder-123'}}})).toThrow(
        'YandexGPT API key and folder ID not configured. Set them in Integration Settings or set the YANDEX_API_KEY and YANDEX_FOLDER_ID environment variables.',
      )
    })

    it('throws for YandexGPT when folder_id absent', () => {
      expect(() => getLLM({type: Model.YandexGPT, settings: {yandex: {apiKey: 'sk-key'}}})).toThrow(
        'YandexGPT API key and folder ID not configured. Set them in Integration Settings or set the YANDEX_API_KEY and YANDEX_FOLDER_ID environment variables.',
      )
    })

    it('throws for YandexGPT when both apiKey and folder_id absent', () => {
      expect(() => getLLM({type: Model.YandexGPT, settings: {yandex: {}}})).toThrow(
        'YandexGPT API key and folder ID not configured. Set them in Integration Settings or set the YANDEX_API_KEY and YANDEX_FOLDER_ID environment variables.',
      )
    })
  })

  describe('treats empty string as absent', () => {
    it('throws when apiKey is empty string for OpenAI', () => {
      expect(() => getLLM({type: Model.OpenAI, settings: {openai: {apiKey: ''}}})).toThrow(
        'OpenAI API key not configured',
      )
    })

    it('throws when apiKey is empty string for Claude', () => {
      expect(() => getLLM({type: Model.Claude, settings: {claude: {apiKey: ''}}})).toThrow(
        'Claude API key not configured',
      )
    })
  })

  describe('succeeds when apiKey present', () => {
    it('does not throw for OpenAI when apiKey present', () => {
      expect(() => getLLM({type: Model.OpenAI, settings: {openai: {apiKey: 'sk-key'}}})).not.toThrow()
    })

    it('does not throw for YandexGPT when both apiKey and folder_id present', () => {
      expect(() =>
        getLLM({type: Model.YandexGPT, settings: {yandex: {apiKey: 'sk-key', folder_id: 'folder-123'}}}),
      ).not.toThrow()
    })
  })

  describe('CustomLLM excluded from apiKey requirement', () => {
    it('does not throw when apiRootUrl present (no apiKey required)', () => {
      expect(() =>
        getLLM({type: Model.CustomLLM, settings: {custom_llm: {apiRootUrl: 'https://api.custom.com'}}}),
      ).not.toThrow()
    })
  })
})

describe('getEmbeddings error handling for missing API keys', () => {
  const {getEmbeddings} = require('./getLLM')

  describe('throws descriptive error when apiKey missing', () => {
    it('throws for OpenAI when apiKey absent', () => {
      expect(() => getEmbeddings({type: Model.OpenAI, settings: {openai: {}}})).toThrow(
        'OpenAI API key not configured for embeddings. Set it in Integration Settings or set the OPENAI_API_KEY environment variable.',
      )
    })

    it('throws for OpenAI when apiKey is empty string', () => {
      expect(() => getEmbeddings({type: Model.OpenAI, settings: {openai: {apiKey: ''}}})).toThrow(
        'OpenAI API key not configured for embeddings',
      )
    })
  })

  describe('succeeds when apiKey present', () => {
    it('does not throw for OpenAI when apiKey present', () => {
      expect(() => getEmbeddings({type: Model.OpenAI, settings: {openai: {apiKey: 'sk-key'}}})).not.toThrow()
    })
  })

  describe('providers without apiKey requirement', () => {
    it('does not throw for CustomLLM (uses apiRootUrl)', () => {
      expect(() =>
        getEmbeddings({type: Model.CustomLLM, settings: {custom_llm: {apiRootUrl: 'https://api.custom.com'}}}),
      ).not.toThrow()
    })
  })
})

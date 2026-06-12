import {EmbStorageType} from '../../../../../shared/config/constants'
import {determineLLMType, getEmbeddings, getIntegrationSettings, getLLM, Model} from './getLLM'
import IntegrationFacade from '../../../../../repositories/IntegrationFacade'
import {MOCK_EXTERNAL_SERVICES_ALLOW_ENV} from './MockExternalServices'
import {withEnvAsync as withEnv} from '../../../../../test/env'

const ALL_PROVIDER_ENV_VARS = {
  OPENAI_API_KEY: undefined,
  CLAUDE_API_KEY: undefined,
  PERPLEXITY_API_KEY: undefined,
  DEEPSEEK_API_KEY: undefined,
  QWEN_API_KEY: undefined,
  YANDEX_API_KEY: undefined,
  YANDEX_FOLDER_ID: undefined,
}

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

  it('throws when no DB record exists and no env vars are set', async () => {
    IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({merged: null, workflowDoc: null})

    await expect(withEnv(ALL_PROVIDER_ENV_VARS, () => getIntegrationSettings('user-1'))).rejects.toThrow(
      'No LLM credentials configured',
    )
  })

  it('returns synthetic settings without DB lookup under MOCK_EXTERNAL_SERVICES=true', async () => {
    const store = {}

    const result = await withEnv({...ALL_PROVIDER_ENV_VARS, MOCK_EXTERNAL_SERVICES: 'true'}, () =>
      getIntegrationSettings('user-1', 'workflow-1', store),
    )

    expect(IntegrationFacade.findMergedDecryptedWithMetadata).not.toHaveBeenCalled()
    expect(result).toMatchObject({userId: 'user-1', workflowId: 'workflow-1'})
    expect(store._integrationSettingsCache).toBe(result)
  })

  it('mock settings path still applies environment credential fallback without DB lookup', async () => {
    const store = {}

    const result = await withEnv(
      {
        ...ALL_PROVIDER_ENV_VARS,
        MOCK_EXTERNAL_SERVICES: 'true',
        OPENAI_API_KEY: 'sk-openai-env',
        CLAUDE_API_KEY: 'sk-claude-env',
      },
      () => getIntegrationSettings('user-1', 'workflow-1', store),
    )

    expect(IntegrationFacade.findMergedDecryptedWithMetadata).not.toHaveBeenCalled()
    expect(result.openai.apiKey).toBe('sk-openai-env')
    expect(result.claude.apiKey).toBe('sk-claude-env')
    expect(store._integrationSettingsCache).toBe(result)
  })

  it('returns cached settings before mock synthesis or repository lookup', async () => {
    const cached = {userId: 'cached-user', workflowId: 'cached-workflow', model: Model.Claude}
    const store = {_integrationSettingsCache: cached}

    const result = await withEnv({MOCK_EXTERNAL_SERVICES: 'true'}, () =>
      getIntegrationSettings('user-1', 'workflow-1', store),
    )

    expect(result).toBe(cached)
    expect(IntegrationFacade.findMergedDecryptedWithMetadata).not.toHaveBeenCalled()
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

    it('propagates detected workflow provider into the model field of the returned settings', async () => {
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
    it('fills absent provider credential from env when DB record exists', async () => {
      const merged = {userId: 'user-1', workflowId: null, model: 'auto'}
      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({merged, workflowDoc: null})

      const result = await withEnv({OPENAI_API_KEY: 'sk-env-only'}, () => getIntegrationSettings('user-1', null))

      expect(result.openai.apiKey).toBe('sk-env-only')
    })

    it('builds synthetic settings from env when DB returns null', async () => {
      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({merged: null, workflowDoc: null})

      const result = await withEnv({OPENAI_API_KEY: 'sk-env-synthetic'}, () => getIntegrationSettings('user-1', null))

      expect(result.openai.apiKey).toBe('sk-env-synthetic')
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

describe('getLLM thinkingBudgetTokens passthrough', () => {
  const {getLLM} = require('./getLLM')

  describe('Claude — budget propagation', () => {
    it.each([500, 1000, 2000, 10000])('passes thinkingBudgetTokens=%i to ChatClaude', budget => {
      const {llm} = getLLM({
        type: Model.Claude,
        settings: {claude: {apiKey: 'sk-ant-test', model: 'claude-sonnet-4-6'}},
        thinkingBudgetTokens: budget,
      })
      expect(llm.thinkingBudgetTokens).toBe(budget)
    })

    it('leaves thinkingBudgetTokens null on ChatClaude when not provided', () => {
      const {llm} = getLLM({
        type: Model.Claude,
        settings: {claude: {apiKey: 'sk-ant-test', model: 'claude-sonnet-4-6'}},
      })
      expect(llm.thinkingBudgetTokens).toBeNull()
    })

    it('leaves thinkingBudgetTokens null on ChatClaude when explicitly passed null', () => {
      const {llm} = getLLM({
        type: Model.Claude,
        settings: {claude: {apiKey: 'sk-ant-test', model: 'claude-sonnet-4-6'}},
        thinkingBudgetTokens: null,
      })
      expect(llm.thinkingBudgetTokens).toBeNull()
    })
  })

  describe('non-Claude providers — thinkingBudgetTokens silently ignored', () => {
    it.each([
      [Model.OpenAI, {openai: {apiKey: 'sk-key'}}],
      [Model.Deepseek, {deepseek: {apiKey: 'sk-key'}}],
      [Model.Qwen, {qwen: {apiKey: 'sk-key'}}],
      [Model.CustomLLM, {custom_llm: {apiRootUrl: 'https://api.custom.com'}}],
    ])('does not throw for %s when thinkingBudgetTokens provided', (type, settings) => {
      expect(() => getLLM({type, settings, thinkingBudgetTokens: 2000})).not.toThrow()
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

describe('getLLM MOCK_EXTERNAL_SERVICES gate', () => {
  it.each([Model.OpenAI, Model.Claude, Model.Deepseek, Model.Qwen, Model.YandexGPT, Model.CustomLLM])(
    'returns NoopLLM regardless of declared type (%s) and never consults provider credentials',
    async type => {
      await withEnv({MOCK_EXTERNAL_SERVICES: 'true'}, async () => {
        const {llm, chunkSize} = getLLM({type, settings: {}})
        expect(typeof llm.invoke).toBe('function')
        expect(chunkSize).toBeGreaterThan(0)
        const reply = await llm.invoke([{content: 'sample'}])
        expect(typeof reply.content).toBe('string')
        expect(reply.content.length).toBeGreaterThan(0)
      })
    },
  )

  it.each(['false', '', '1', 'yes', 'TRUE', undefined])(
    'does NOT activate mock when MOCK_EXTERNAL_SERVICES=%s (strict "true" gate)',
    async value => {
      await withEnv({MOCK_EXTERNAL_SERVICES: value}, () => {
        expect(() => getLLM({type: Model.OpenAI, settings: {}})).toThrow(/OpenAI API key not configured/)
      })
    },
  )

  it('mock path ignores empty settings (no credential lookup occurs)', async () => {
    await withEnv({MOCK_EXTERNAL_SERVICES: 'true'}, () => {
      expect(() => getLLM({type: Model.OpenAI, settings: undefined})).not.toThrow()
      expect(() => getLLM({type: Model.YandexGPT, settings: {}})).not.toThrow()
    })
  })

  it.each(['development', 'qa', 'e2e', 'production', undefined])(
    'refuses mock LLM usage in non-allowlisted runtime NODE_ENV=%s before returning NoopLLM',
    async nodeEnv => {
      await withEnv({MOCK_EXTERNAL_SERVICES: 'true', NODE_ENV: nodeEnv}, () => {
        expect(() => getLLM({type: Model.OpenAI, settings: {}})).toThrow(/MOCK_EXTERNAL_SERVICES=true/)
      })
    },
  )

  it.each(['development', 'qa', 'e2e'])(
    'explicit allow env permits mock LLM usage in runtime NODE_ENV=%s',
    async nodeEnv => {
      await withEnv(
        {MOCK_EXTERNAL_SERVICES: 'true', NODE_ENV: nodeEnv, [MOCK_EXTERNAL_SERVICES_ALLOW_ENV]: 'true'},
        () => {
          expect(() => getLLM({type: Model.OpenAI, settings: {}})).not.toThrow()
        },
      )
    },
  )
})

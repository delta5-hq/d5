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
        expect(determineLLMType(settings)).toBe(model)
      },
    )

    it('ignores credentials when model explicitly set', () => {
      const settings = {
        model: Model.Claude,
        openai: {apiKey: 'openai-key'},
        qwen: {apiKey: 'qwen-key'},
      }
      expect(determineLLMType(settings)).toBe(Model.Claude)
    })

    it('ignores lang when model explicitly set', () => {
      const settings = {
        model: Model.Claude,
        lang: 'ru',
      }
      expect(determineLLMType(settings)).toBe(Model.Claude)
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
        expect(determineLLMType(settings)).toBe(expected)
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
        expect(determineLLMType(settings)).toBe(Model.OpenAI)
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
        expect(determineLLMType(settings)).toBe(Model.Claude)
      })

      it('prefers Qwen over Deepseek, CustomLLM, Yandex', () => {
        const settings = {
          model: 'auto',
          qwen: {apiKey: 'qwen-key'},
          deepseek: {apiKey: 'deepseek-key'},
          custom_llm: {apiRootUrl: 'http://localhost:8080'},
          yandex: {apiKey: 'yandex-key'},
        }
        expect(determineLLMType(settings)).toBe(Model.Qwen)
      })

      it('prefers Deepseek over CustomLLM, Yandex', () => {
        const settings = {
          model: 'auto',
          deepseek: {apiKey: 'deepseek-key'},
          custom_llm: {apiRootUrl: 'http://localhost:8080'},
          yandex: {apiKey: 'yandex-key'},
        }
        expect(determineLLMType(settings)).toBe(Model.Deepseek)
      })

      it('prefers CustomLLM over Yandex', () => {
        const settings = {
          model: 'auto',
          custom_llm: {apiRootUrl: 'http://localhost:8080'},
          yandex: {apiKey: 'yandex-key'},
        }
        expect(determineLLMType(settings)).toBe(Model.CustomLLM)
      })
    })

    describe('invalid credential handling', () => {
      it('ignores empty provider objects', () => {
        const settings = {
          model: 'auto',
          openai: {},
          claude: {apiKey: 'claude-key'},
        }
        expect(determineLLMType(settings)).toBe(Model.Claude)
      })

      it('ignores null credentials', () => {
        const settings = {
          model: 'auto',
          openai: {apiKey: null},
          claude: {apiKey: 'claude-key'},
        }
        expect(determineLLMType(settings)).toBe(Model.Claude)
      })

      it('ignores undefined credentials', () => {
        const settings = {
          model: 'auto',
          openai: {apiKey: undefined},
          claude: {apiKey: 'claude-key'},
        }
        expect(determineLLMType(settings)).toBe(Model.Claude)
      })

      it('ignores empty string credentials', () => {
        const settings = {
          model: 'auto',
          openai: {apiKey: ''},
          claude: {apiKey: 'claude-key'},
        }
        expect(determineLLMType(settings)).toBe(Model.Claude)
      })

      it('treats whitespace-only credentials as invalid', () => {
        const settings = {
          model: 'auto',
          openai: {apiKey: '   '},
          claude: {apiKey: 'claude-key'},
        }
        expect(determineLLMType(settings)).toBe(Model.Claude)
      })
    })
  })

  describe('ultimate fallback (lowest priority)', () => {
    it('returns OpenAI when model=auto and no credentials', () => {
      const settings = {model: 'auto'}
      expect(determineLLMType(settings)).toBe(Model.OpenAI)
    })

    it('returns OpenAI when settings is empty object', () => {
      expect(determineLLMType({})).toBe(Model.OpenAI)
    })

    it('returns OpenAI when settings is null', () => {
      expect(determineLLMType(null)).toBe(Model.OpenAI)
    })

    it('returns OpenAI when settings is undefined', () => {
      expect(determineLLMType(undefined)).toBe(Model.OpenAI)
    })
  })

  describe('lang field does not influence provider selection', () => {
    it('selects by credential priority when model=auto and lang=ru both set', () => {
      const settings = {
        model: 'auto',
        lang: 'ru',
        openai: {apiKey: 'openai-key'},
        yandex: {apiKey: 'yandex-key'},
      }
      expect(determineLLMType(settings)).toBe(Model.OpenAI)
    })

    it('produces identical result with and without lang field present', () => {
      const base = {model: 'auto', openai: {apiKey: 'openai-key'}}
      expect(determineLLMType({...base, lang: 'ru'})).toBe(determineLLMType(base))
    })

    it('lang field alone with no credentials still falls back to OpenAI', () => {
      expect(determineLLMType({model: 'auto', lang: 'ru'})).toBe(Model.OpenAI)
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
    IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
      merged: null,
      workflowDoc: null,
    })

    await expect(withEnv(ALL_PROVIDER_ENV_VARS, () => getIntegrationSettings('user-1'))).rejects.toThrow(
      'No LLM credentials configured',
    )
  })

  it('resolves settings under MOCK_EXTERNAL_SERVICES=true, still consulting the store so configured keys are honored', async () => {
    // Under a mock runtime only the LLM transport is mocked, not settings
    // resolution: a genuinely-configured provider key must still be honored,
    // which requires the integration lookup. When it yields no record the
    // resolver falls back to synthetic/env settings.
    IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({merged: null, workflowDoc: null})
    const store = {}

    const result = await withEnv({...ALL_PROVIDER_ENV_VARS, MOCK_EXTERNAL_SERVICES: 'true'}, () =>
      getIntegrationSettings('user-1', 'workflow-1', store),
    )

    expect(IntegrationFacade.findMergedDecryptedWithMetadata).toHaveBeenCalledWith('user-1', 'workflow-1')
    expect(result).toMatchObject({userId: 'user-1', workflowId: 'workflow-1'})
    expect(store._integrationSettingsCache).toBe(result)
  })

  it('applies environment credential fallback under mock when the integration lookup yields no record', async () => {
    IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({merged: null, workflowDoc: null})
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

    expect(IntegrationFacade.findMergedDecryptedWithMetadata).toHaveBeenCalled()
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
    const merged = {
      userId: 'user-1',
      workflowId: null,
      openai: {apiKey: 'sk-key'},
      model: 'auto',
    }
    IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
      merged,
      workflowDoc: null,
    })

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
    const workflowDoc = {
      userId: 'user-1',
      workflowId: 'wf-1',
      claude: {apiKey: 'sk-workflow'},
    }

    IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
      merged,
      workflowDoc,
    })

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
      const workflowDoc = {
        userId: 'user-1',
        workflowId: 'wf-1',
        [providerKey]: credentials,
      }

      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
        merged,
        workflowDoc,
      })

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

    IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
      merged,
      workflowDoc,
    })

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

    IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
      merged,
      workflowDoc: null,
    })

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

    IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
      merged,
      workflowDoc,
    })

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
      const workflowDoc = {
        userId: 'user-1',
        workflowId: 'wf-1',
        claude: {apiKey: ''},
      }

      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
        merged,
        workflowDoc,
      })

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
      const workflowDoc = {
        userId: 'user-1',
        workflowId: 'wf-1',
        claude: {apiKey: '   '},
      }

      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
        merged,
        workflowDoc,
      })

      const result = await getIntegrationSettings('user-1', 'wf-1')

      expect(result.model).toBe('auto')
    })

    it('does not modify model when workflow provider credential is undefined', async () => {
      const merged = {
        userId: 'user-1',
        workflowId: 'wf-1',
        openai: {apiKey: 'sk-global'},
        claude: {apiKey: undefined},
        model: 'auto',
      }
      const workflowDoc = {
        userId: 'user-1',
        workflowId: 'wf-1',
        claude: {apiKey: undefined},
      }

      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
        merged,
        workflowDoc,
      })

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
      const workflowDoc = {
        userId: 'user-1',
        workflowId: 'wf-1',
        claude: {apiKey: 'sk-workflow'},
        model: 'auto',
      }

      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
        merged,
        workflowDoc,
      })

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
      const workflowDoc = {
        userId: 'user-1',
        workflowId: 'wf-1',
        claude: {apiKey: 'sk-workflow'},
        model: Model.Qwen,
      }

      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
        merged,
        workflowDoc,
      })

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
      const workflowDoc = {
        userId: 'user-1',
        workflowId: 'wf-1',
        claude: {apiKey: 'sk-workflow'},
      }

      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
        merged,
        workflowDoc,
      })

      await getIntegrationSettings('user-1', 'wf-1')

      expect(merged.model).toBe(Model.Claude)
    })
  })

  describe('environment variable fallback behavior', () => {
    it('fills absent provider credential from env when DB record exists', async () => {
      const merged = {userId: 'user-1', workflowId: null, model: 'auto'}
      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
        merged,
        workflowDoc: null,
      })

      const result = await withEnv({OPENAI_API_KEY: 'sk-env-only'}, () => getIntegrationSettings('user-1', null))

      expect(result.openai.apiKey).toBe('sk-env-only')
    })

    it('builds synthetic settings from env when DB returns null', async () => {
      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
        merged: null,
        workflowDoc: null,
      })

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
        workflowDoc: {
          userId: 'user-1',
          workflowId: 'wf-1',
          claude: {apiKey: 'sk-workflow-claude'},
        },
      })

      const result = await getIntegrationSettings('user-1', 'wf-1')

      expect(result.claude.apiKey).toBe('sk-workflow-claude')
    })
  })

  describe('store cache scope isolation', () => {
    const settingsFor = (userId, workflowId, providerKey, providerSettings) => ({
      userId,
      workflowId,
      [providerKey]: providerSettings,
      model: 'auto',
    })

    const mockSettingsSequence = requests => {
      requests.forEach(({userId, workflowId, providerKey, providerSettings}) => {
        const settings = settingsFor(userId, workflowId, providerKey, providerSettings)
        IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValueOnce({
          merged: settings,
          workflowDoc: workflowId ? settings : null,
        })
      })
    }

    it.each([
      [
        'user scope and workflow scope',
        [
          {
            userId: 'user-1',
            workflowId: null,
            providerKey: 'openai',
            providerSettings: {apiKey: 'sk-user'},
          },
          {
            userId: 'user-1',
            workflowId: 'wf-1',
            providerKey: 'custom_llm',
            providerSettings: {apiRootUrl: 'https://custom.workflow.test'},
          },
        ],
        'custom_llm',
        'apiRootUrl',
        'https://custom.workflow.test',
      ],
      [
        'two workflow scopes',
        [
          {
            userId: 'user-1',
            workflowId: 'wf-1',
            providerKey: 'custom_llm',
            providerSettings: {apiRootUrl: 'https://custom.first.test'},
          },
          {
            userId: 'user-1',
            workflowId: 'wf-2',
            providerKey: 'custom_llm',
            providerSettings: {apiRootUrl: 'https://custom.second.test'},
          },
        ],
        'custom_llm',
        'apiRootUrl',
        'https://custom.second.test',
      ],
      [
        'two users sharing the same workflow id',
        [
          {
            userId: 'user-1',
            workflowId: 'wf-1',
            providerKey: 'openai',
            providerSettings: {apiKey: 'sk-user-1'},
          },
          {
            userId: 'user-2',
            workflowId: 'wf-1',
            providerKey: 'openai',
            providerSettings: {apiKey: 'sk-user-2'},
          },
        ],
        'openai',
        'apiKey',
        'sk-user-2',
      ],
    ])(
      'does not reuse cached settings across %s',
      async (_caseName, requests, providerKey, fieldKey, expectedValue) => {
        const store = {}
        mockSettingsSequence(requests)

        await getIntegrationSettings(requests[0].userId, requests[0].workflowId, store)
        const result = await getIntegrationSettings(requests[1].userId, requests[1].workflowId, store)

        expect(result[providerKey][fieldKey]).toBe(expectedValue)
        expect(IntegrationFacade.findMergedDecryptedWithMetadata).toHaveBeenCalledTimes(2)
        requests.forEach((request, index) => {
          expect(IntegrationFacade.findMergedDecryptedWithMetadata).toHaveBeenNthCalledWith(
            index + 1,
            request.userId,
            request.workflowId,
          )
        })
      },
    )

    it.each([
      ['user scope', 'user-1', null],
      ['workflow scope', 'user-1', 'wf-1'],
      ['second user workflow scope', 'user-2', 'wf-1'],
    ])('reuses cached settings for the same %s', async (_caseName, userId, workflowId) => {
      const store = {}
      const settings = {
        userId,
        workflowId,
        custom_llm: {
          apiRootUrl: `https://${userId}-${workflowId || 'global'}.test`,
        },
        model: 'auto',
      }

      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
        merged: settings,
        workflowDoc: workflowId ? settings : null,
      })

      const firstResult = await getIntegrationSettings(userId, workflowId, store)
      const secondResult = await getIntegrationSettings(userId, workflowId, store)

      expect(secondResult).toBe(firstResult)
      expect(IntegrationFacade.findMergedDecryptedWithMetadata).toHaveBeenCalledTimes(1)
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
      expect(() =>
        getLLM({
          type: Model.YandexGPT,
          settings: {yandex: {folder_id: 'folder-123'}},
        }),
      ).toThrow(
        'YandexGPT API key and folder ID not configured. Set them in Integration Settings or set the YANDEX_API_KEY and YANDEX_FOLDER_ID environment variables.',
      )
    })

    it('throws for YandexGPT when folder_id absent', () => {
      expect(() =>
        getLLM({
          type: Model.YandexGPT,
          settings: {yandex: {apiKey: 'sk-key'}},
        }),
      ).toThrow(
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
      expect(() =>
        getLLM({
          type: Model.OpenAI,
          settings: {openai: {apiKey: 'sk-key'}},
        }),
      ).not.toThrow()
    })

    it('does not throw for YandexGPT when both apiKey and folder_id present', () => {
      expect(() =>
        getLLM({
          type: Model.YandexGPT,
          settings: {yandex: {apiKey: 'sk-key', folder_id: 'folder-123'}},
        }),
      ).not.toThrow()
    })
  })

  describe('CustomLLM URL validation', () => {
    it('does not throw when apiRootUrl is a valid URL (apiKey not required)', () => {
      expect(() =>
        getLLM({
          type: Model.CustomLLM,
          settings: {custom_llm: {apiRootUrl: 'https://api.custom.com'}},
        }),
      ).not.toThrow()
    })

    it.each([
      ['empty string', {custom_llm: {apiRootUrl: ''}}],
      ['absent from custom_llm object', {custom_llm: {}}],
      ['custom_llm absent', {}],
      ['settings is null', null],
    ])('throws when apiRootUrl is %s', (_label, settings) => {
      expect(() => getLLM({type: Model.CustomLLM, settings})).toThrow('Custom LLM API URL not configured')
    })
  })

  describe('CustomLLM chunk size', () => {
    it('returns default maxTokens (30000) as chunkSize when maxTokens absent from settings', () => {
      const {chunkSize} = getLLM({
        type: Model.CustomLLM,
        settings: {custom_llm: {apiRootUrl: 'https://api.custom.com'}},
      })
      expect(chunkSize).toBe(30000)
    })

    it('returns the configured maxTokens as chunkSize', () => {
      const {chunkSize} = getLLM({
        type: Model.CustomLLM,
        settings: {custom_llm: {apiRootUrl: 'https://api.custom.com', maxTokens: 8192}},
      })
      expect(chunkSize).toBe(8192)
    })
  })

  describe('CustomLLM credential passthrough', () => {
    it('passes apiKey to CustomLLMChat when provided', () => {
      const {llm} = getLLM({
        type: Model.CustomLLM,
        settings: {custom_llm: {apiRootUrl: 'https://api.custom.com', apiKey: 'sk-custom-key'}},
      })
      expect(llm.apiKey).toBe('sk-custom-key')
    })

    it('passes model to CustomLLMChat when provided', () => {
      const {llm} = getLLM({
        type: Model.CustomLLM,
        settings: {custom_llm: {apiRootUrl: 'https://api.custom.com', model: 'llama-3.1-8b'}},
      })
      expect(llm.model).toBe('llama-3.1-8b')
    })

    it('defaults model to gpt-4o-mini on CustomLLMChat when absent from OpenAI-compatible settings', () => {
      const {llm} = getLLM({
        type: Model.CustomLLM,
        settings: {custom_llm: {apiRootUrl: 'https://api.custom.com'}},
      })
      expect(llm.model).toBe('gpt-4o-mini')
    })
  })
})

describe('getLLM thinkingBudgetTokens passthrough', () => {
  const {getLLM} = require('./getLLM')

  describe('Claude — budget propagation', () => {
    it.each([500, 1000, 2000, 10000])('passes thinkingBudgetTokens=%i to ChatClaude', budget => {
      const {llm} = getLLM({
        type: Model.Claude,
        settings: {
          claude: {apiKey: 'sk-ant-test', model: 'claude-sonnet-4-6'},
        },
        thinkingBudgetTokens: budget,
      })
      expect(llm.thinkingBudgetTokens).toBe(budget)
    })

    it('leaves thinkingBudgetTokens null on ChatClaude when not provided', () => {
      const {llm} = getLLM({
        type: Model.Claude,
        settings: {
          claude: {apiKey: 'sk-ant-test', model: 'claude-sonnet-4-6'},
        },
      })
      expect(llm.thinkingBudgetTokens).toBeNull()
    })

    it('leaves thinkingBudgetTokens null on ChatClaude when explicitly passed null', () => {
      const {llm} = getLLM({
        type: Model.Claude,
        settings: {
          claude: {apiKey: 'sk-ant-test', model: 'claude-sonnet-4-6'},
        },
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
      expect(() =>
        getEmbeddings({
          type: Model.OpenAI,
          settings: {openai: {apiKey: ''}},
        }),
      ).toThrow('OpenAI API key not configured for embeddings')
    })
  })

  describe('succeeds when apiKey present', () => {
    it('does not throw for OpenAI when apiKey present', () => {
      expect(() =>
        getEmbeddings({
          type: Model.OpenAI,
          settings: {openai: {apiKey: 'sk-key'}},
        }),
      ).not.toThrow()
    })
  })

  describe('providers without apiKey requirement', () => {
    it('does not throw for CustomLLM (uses apiRootUrl)', () => {
      expect(() =>
        getEmbeddings({
          type: Model.CustomLLM,
          settings: {custom_llm: {apiRootUrl: 'https://api.custom.com'}},
        }),
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

describe('getEmbeddings MOCK_EXTERNAL_SERVICES gate', () => {
  it.each([Model.OpenAI, Model.Claude, Model.Deepseek, Model.Qwen, Model.YandexGPT, Model.CustomLLM])(
    'returns NoopEmbeddings regardless of declared type (%s) and never consults provider credentials',
    async type => {
      await withEnv({MOCK_EXTERNAL_SERVICES: 'true'}, async () => {
        const {embeddings, chunkSize, similarityThreshold, storageType} = getEmbeddings({type, settings: {}})
        const documents = await embeddings.embedDocuments(['D5 MCP command'])
        const query = await embeddings.embedQuery('D5 MCP command')

        expect(documents).toHaveLength(1)
        expect(documents[0]).toHaveLength(query.length)
        expect(chunkSize).toBeGreaterThan(0)
        expect(similarityThreshold).toBe(0)
        expect(storageType).toBe(EmbStorageType.openai)
      })
    },
  )

  it.each(['false', '', '1', 'yes', 'TRUE', undefined])(
    'does NOT activate mock embeddings when MOCK_EXTERNAL_SERVICES=%s (strict "true" gate)',
    value => {
      withEnv({MOCK_EXTERNAL_SERVICES: value}, () => {
        expect(() => getEmbeddings({type: Model.OpenAI, settings: {}})).toThrow(/OpenAI API key not configured/)
      })
    },
  )
})

describe('getEmbeddings — fallback resolution for non-native embeddings providers', () => {
  const {getEmbeddings} = require('./getLLM')

  describe('non-native type resolves to best available native embeddings provider', () => {
    it.each([Model.Claude, Model.Deepseek])('%s with OpenAI credentials resolves to OpenAI embeddings', type => {
      const result = getEmbeddings({
        type,
        settings: {openai: {apiKey: 'sk-openai'}},
      })
      expect(result.storageType).toBe(EmbStorageType.openai)
      expect(result.embeddings.constructor.name).toBe('OpenAIEmbeddings')
    })

    it.each([Model.Claude, Model.Deepseek])('%s with Qwen credentials resolves to Qwen embeddings', type => {
      const result = getEmbeddings({
        type,
        settings: {qwen: {apiKey: 'qk'}},
      })
      expect(result.storageType).toBe(EmbStorageType.qwen)
    })

    it.each([Model.Claude, Model.Deepseek])('%s with CustomLLM credentials resolves to CustomLLM embeddings', type => {
      const result = getEmbeddings({
        type,
        settings: {custom_llm: {apiRootUrl: 'https://api.custom.com'}},
      })
      expect(result.storageType).toBe(EmbStorageType.custom_llm)
    })

    it.each([Model.Claude, Model.Deepseek])('%s with Yandex credentials resolves to Yandex embeddings', type => {
      const result = getEmbeddings({
        type,
        settings: {yandex: {apiKey: 'yk', folder_id: 'fid'}},
      })
      expect(result.storageType).toBe(EmbStorageType.yandex)
    })

    it('fallback follows the same priority order as resolveEmbeddingsFallbackType (OpenAI before Qwen)', () => {
      const result = getEmbeddings({
        type: Model.Claude,
        settings: {
          openai: {apiKey: 'sk'},
          qwen: {apiKey: 'qk'},
          yandex: {apiKey: 'yk', folder_id: 'fid'},
        },
      })
      expect(result.storageType).toBe(EmbStorageType.openai)
    })
  })

  describe('throws when a non-native type has no embeddings-capable provider configured', () => {
    it.each([Model.Claude, Model.Deepseek])('throws for %s when settings is empty', type => {
      expect(() => getEmbeddings({type, settings: {}})).toThrow(/No embeddings provider configured/)
    })

    it.each([Model.Claude, Model.Deepseek])('throws for %s when settings is null', type => {
      expect(() => getEmbeddings({type, settings: null})).toThrow(/No embeddings provider configured/)
    })

    it.each([Model.Claude, Model.Deepseek])(
      'throws for %s when only its own credentials are present (no embeddings-capable provider)',
      type => {
        const providerKey = type.toLowerCase()
        expect(() => getEmbeddings({type, settings: {[providerKey]: {apiKey: 'sk'}}})).toThrow(
          /No embeddings provider configured/,
        )
      },
    )

    it.each([Model.Claude, Model.Deepseek])('throws for %s when all native provider credentials are blank', type => {
      expect(() =>
        getEmbeddings({
          type,
          settings: {
            openai: {apiKey: ''},
            qwen: {apiKey: '  '},
            custom_llm: {apiRootUrl: null},
          },
        }),
      ).toThrow(/No embeddings provider configured/)
    })
  })
})

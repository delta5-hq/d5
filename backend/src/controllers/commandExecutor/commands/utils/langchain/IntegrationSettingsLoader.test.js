import {detectConfiguredProvider, loadIntegrationSettings, Model} from './IntegrationSettingsLoader'
import IntegrationFacade from '../../../../../repositories/IntegrationFacade'

jest.mock('../../../../../repositories/IntegrationFacade', () => ({
  findMergedDecryptedWithMetadata: jest.fn(),
}))

jest.mock('./IntegrationSettingsResolver', () => ({
  resolveSettings: jest.fn(({merged, workflowDoc, userId, workflowId}) => ({
    settings: merged ? {...merged} : {userId, workflowId, model: 'auto'},
    workflowDoc: workflowDoc ?? null,
  })),
}))

import {resolveSettings} from './IntegrationSettingsResolver'

describe('Model', () => {
  it('defines all six provider enum values', () => {
    expect(Object.keys(Model)).toHaveLength(6)
  })

  it.each([
    ['OpenAI', 'OpenAI'],
    ['Claude', 'Claude'],
    ['Qwen', 'Qwen'],
    ['Deepseek', 'Deepseek'],
    ['YandexGPT', 'YandexGPT'],
    ['CustomLLM', 'CustomLLM'],
  ])('Model.%s has string value "%s"', (key, expectedValue) => {
    expect(Model[key]).toBe(expectedValue)
  })

  it('all values are distinct', () => {
    const values = Object.values(Model)
    expect(new Set(values).size).toBe(values.length)
  })
})

describe('detectConfiguredProvider', () => {
  describe('null and empty input', () => {
    it('returns null for null settings', () => {
      expect(detectConfiguredProvider(null)).toBeNull()
    })

    it('returns null for undefined settings', () => {
      expect(detectConfiguredProvider(undefined)).toBeNull()
    })

    it('returns null for empty object settings', () => {
      expect(detectConfiguredProvider({})).toBeNull()
    })

    it('returns null when no provider section present', () => {
      expect(detectConfiguredProvider({userId: 'u1', model: 'auto'})).toBeNull()
    })
  })

  describe('provider detection — all providers', () => {
    it.each([
      ['openai', 'apiKey', Model.OpenAI],
      ['claude', 'apiKey', Model.Claude],
      ['qwen', 'apiKey', Model.Qwen],
      ['deepseek', 'apiKey', Model.Deepseek],
      ['custom_llm', 'apiRootUrl', Model.CustomLLM],
      ['yandex', 'apiKey', Model.YandexGPT],
    ])('detects %s provider when %s is present', (providerKey, credentialKey, expected) => {
      const settings = {[providerKey]: {[credentialKey]: 'valid-credential'}}
      expect(detectConfiguredProvider(settings)).toBe(expected)
    })
  })

  describe('credential validation — invalid values treated as absent', () => {
    it.each([
      ['empty string', ''],
      ['whitespace only', '   '],
      ['tab character', '\t'],
      ['newline only', '\n'],
    ])('ignores %s credential (%j)', (_label, credentialValue) => {
      const settings = {openai: {apiKey: credentialValue}}
      expect(detectConfiguredProvider(settings)).toBeNull()
    })

    it('ignores null credential', () => {
      expect(detectConfiguredProvider({openai: {apiKey: null}})).toBeNull()
    })

    it('ignores undefined credential', () => {
      expect(detectConfiguredProvider({openai: {apiKey: undefined}})).toBeNull()
    })

    it('ignores false credential', () => {
      expect(detectConfiguredProvider({openai: {apiKey: false}})).toBeNull()
    })

    it('ignores numeric zero credential (falsy)', () => {
      expect(detectConfiguredProvider({openai: {apiKey: 0}})).toBeNull()
    })

    it('accepts non-blank string credential', () => {
      expect(detectConfiguredProvider({openai: {apiKey: 'sk-x'}})).toBe(Model.OpenAI)
    })
  })

  describe('provider priority order', () => {
    const ALL_PROVIDERS = {
      openai: {apiKey: 'k'},
      claude: {apiKey: 'k'},
      qwen: {apiKey: 'k'},
      deepseek: {apiKey: 'k'},
      custom_llm: {apiRootUrl: 'http://localhost'},
      yandex: {apiKey: 'k'},
    }

    it('prefers OpenAI over all others when all configured', () => {
      expect(detectConfiguredProvider(ALL_PROVIDERS)).toBe(Model.OpenAI)
    })

    it('prefers Claude over Qwen, Deepseek, CustomLLM, YandexGPT', () => {
      const {openai: _o, ...without} = ALL_PROVIDERS
      expect(detectConfiguredProvider(without)).toBe(Model.Claude)
    })

    it('prefers Qwen over Deepseek, CustomLLM, YandexGPT', () => {
      const {openai: _o, claude: _c, ...without} = ALL_PROVIDERS
      expect(detectConfiguredProvider(without)).toBe(Model.Qwen)
    })

    it('prefers Deepseek over CustomLLM, YandexGPT', () => {
      const {openai: _o, claude: _c, qwen: _q, ...without} = ALL_PROVIDERS
      expect(detectConfiguredProvider(without)).toBe(Model.Deepseek)
    })

    it('prefers CustomLLM over YandexGPT', () => {
      const {openai: _o, claude: _c, qwen: _q, deepseek: _d, ...without} = ALL_PROVIDERS
      expect(detectConfiguredProvider(without)).toBe(Model.CustomLLM)
    })

    it('returns YandexGPT when only yandex configured', () => {
      expect(detectConfiguredProvider({yandex: {apiKey: 'k'}})).toBe(Model.YandexGPT)
    })
  })

  describe('partial and missing provider object', () => {
    it('returns null when provider section is present but credential key is absent', () => {
      expect(detectConfiguredProvider({openai: {}})).toBeNull()
    })

    it('returns null when provider section itself is null', () => {
      expect(detectConfiguredProvider({openai: null})).toBeNull()
    })

    it('skips providers with invalid credentials and returns the next valid one', () => {
      const settings = {
        openai: {apiKey: ''},
        claude: {apiKey: 'sk-valid'},
      }
      expect(detectConfiguredProvider(settings)).toBe(Model.Claude)
    })

    it('uses apiRootUrl (not apiKey) for CustomLLM detection', () => {
      expect(detectConfiguredProvider({custom_llm: {apiKey: 'ignored'}})).toBeNull()
      expect(detectConfiguredProvider({custom_llm: {apiRootUrl: 'http://host'}})).toBe(Model.CustomLLM)
    })
  })
})

describe('loadIntegrationSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('facade delegation', () => {
    it('calls findMergedDecryptedWithMetadata with userId and workflowId', async () => {
      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
        merged: {openai: {apiKey: 'k'}, model: 'auto'},
        workflowDoc: null,
      })

      await loadIntegrationSettings('user-1', 'wf-1')

      expect(IntegrationFacade.findMergedDecryptedWithMetadata).toHaveBeenCalledTimes(1)
      expect(IntegrationFacade.findMergedDecryptedWithMetadata).toHaveBeenCalledWith('user-1', 'wf-1')
    })

    it('passes null workflowId by default', async () => {
      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
        merged: {openai: {apiKey: 'k'}, model: 'auto'},
        workflowDoc: null,
      })

      await loadIntegrationSettings('user-1')

      expect(IntegrationFacade.findMergedDecryptedWithMetadata).toHaveBeenCalledWith('user-1', null)
    })

    it('propagates facade errors', async () => {
      IntegrationFacade.findMergedDecryptedWithMetadata.mockRejectedValue(new Error('DB unavailable'))

      await expect(loadIntegrationSettings('user-1')).rejects.toThrow('DB unavailable')
    })
  })

  describe('settings resolver delegation', () => {
    it('passes fetched data through resolveSettings', async () => {
      const fetchedMerged = {openai: {apiKey: 'k'}, model: 'auto'}
      const fetchedWorkflowDoc = {claude: {apiKey: 'wf-key'}}
      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
        merged: fetchedMerged,
        workflowDoc: fetchedWorkflowDoc,
      })

      await loadIntegrationSettings('user-1', 'wf-1')

      expect(resolveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          merged: fetchedMerged,
          workflowDoc: fetchedWorkflowDoc,
          userId: 'user-1',
          workflowId: 'wf-1',
        }),
      )
    })

    it('returns the settings object from resolveSettings (not the raw fetch)', async () => {
      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
        merged: {openai: {apiKey: 'resolved-key'}, model: 'auto'},
        workflowDoc: null,
      })

      const result = await loadIntegrationSettings('user-1')

      expect(result).toEqual(expect.objectContaining({openai: {apiKey: 'resolved-key'}}))
    })

    it('does not return raw fetch shape (no merged/workflowDoc wrapper)', async () => {
      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
        merged: {openai: {apiKey: 'k'}, model: 'auto'},
        workflowDoc: null,
      })

      const result = await loadIntegrationSettings('user-1')

      expect(result).not.toHaveProperty('merged')
      expect(result).not.toHaveProperty('workflowDoc')
    })
  })

  describe('workflow model inference', () => {
    it('infers model from workflowDoc when settings.model is auto', async () => {
      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
        merged: {model: 'auto'},
        workflowDoc: {claude: {apiKey: 'wf-claude-key'}},
      })

      const result = await loadIntegrationSettings('user-1', 'wf-1')

      expect(result.model).toBe(Model.Claude)
    })

    it('does not override model when explicitly set in settings', async () => {
      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
        merged: {model: Model.Qwen, qwen: {apiKey: 'k'}},
        workflowDoc: {claude: {apiKey: 'wf-claude-key'}},
      })

      const result = await loadIntegrationSettings('user-1', 'wf-1')

      expect(result.model).toBe(Model.Qwen)
    })

    it('leaves model as auto when workflowDoc has no configured provider', async () => {
      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
        merged: {model: 'auto'},
        workflowDoc: {userId: 'u1', workflowId: 'wf-1'},
      })

      const result = await loadIntegrationSettings('user-1', 'wf-1')

      expect(result.model).toBe('auto')
    })

    it('skips inference when workflowDoc is null', async () => {
      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
        merged: {openai: {apiKey: 'k'}, model: 'auto'},
        workflowDoc: null,
      })

      const result = await loadIntegrationSettings('user-1')

      expect(result.model).toBe('auto')
    })

    it.each([
      ['openai', 'apiKey', Model.OpenAI],
      ['claude', 'apiKey', Model.Claude],
      ['qwen', 'apiKey', Model.Qwen],
      ['deepseek', 'apiKey', Model.Deepseek],
      ['custom_llm', 'apiRootUrl', Model.CustomLLM],
      ['yandex', 'apiKey', Model.YandexGPT],
    ])('infers %s model from workflowDoc provider %s credential', async (providerKey, credKey, expected) => {
      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
        merged: {model: 'auto'},
        workflowDoc: {[providerKey]: {[credKey]: 'wf-credential'}},
      })

      const result = await loadIntegrationSettings('user-1', 'wf-1')

      expect(result.model).toBe(expected)
    })
  })
})

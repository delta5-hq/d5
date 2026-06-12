import {USER_DEFAULT_MODEL} from '../../../../../shared/config/constants'
import {resolveSettings} from './IntegrationSettingsResolver'
import {MOCK_EXTERNAL_SERVICES_ALLOW_ENV} from './MockExternalServices'
import {withEnv} from '../../../../../test/env'

const ALL_PROVIDER_ENV_VARS_ABSENT = {
  OPENAI_API_KEY: undefined,
  CLAUDE_API_KEY: undefined,
  PERPLEXITY_API_KEY: undefined,
  DEEPSEEK_API_KEY: undefined,
  QWEN_API_KEY: undefined,
  YANDEX_API_KEY: undefined,
  YANDEX_FOLDER_ID: undefined,
}

const nullDbArgs = {merged: null, workflowDoc: null, userId: 'u1', workflowId: null}

describe('resolveSettings', () => {
  describe('return shape', () => {
    it('returns an object with settings and workflowDoc properties', () => {
      const merged = {userId: 'u1', model: 'auto', openai: {apiKey: 'sk-db'}}
      const workflowDoc = {userId: 'u1', workflowId: 'wf-1'}
      const result = resolveSettings({merged, workflowDoc, userId: 'u1', workflowId: 'wf-1'})
      expect(result).toHaveProperty('settings')
      expect(result).toHaveProperty('workflowDoc')
    })

    it('passes workflowDoc through by reference when non-null', () => {
      const merged = {userId: 'u1', model: 'auto', openai: {apiKey: 'sk-db'}}
      const workflowDoc = {userId: 'u1', workflowId: 'wf-1', openai: {apiKey: 'sk-wf'}}
      const result = resolveSettings({merged, workflowDoc, userId: 'u1', workflowId: 'wf-1'})
      expect(result.workflowDoc).toBe(workflowDoc)
    })

    it('passes workflowDoc through as null when null', () => {
      const merged = {userId: 'u1', model: 'auto', openai: {apiKey: 'sk-db'}}
      const result = resolveSettings({merged, workflowDoc: null, userId: 'u1', workflowId: null})
      expect(result.workflowDoc).toBeNull()
    })
  })

  describe('when merged is non-null (DB record exists)', () => {
    it('returns the merged object as settings (same reference)', () => {
      const merged = {userId: 'u1', model: 'auto', openai: {apiKey: 'sk-db'}}
      const {settings} = resolveSettings({merged, workflowDoc: null, userId: 'u1', workflowId: null})
      expect(settings).toBe(merged)
    })

    it('never throws even when merged has no credentials and no env vars', () => {
      const merged = {userId: 'u1', model: 'auto'}
      expect(() =>
        withEnv(ALL_PROVIDER_ENV_VARS_ABSENT, () =>
          resolveSettings({merged, workflowDoc: null, userId: 'u1', workflowId: null}),
        ),
      ).not.toThrow()
    })

    describe('env fallback fills absent credential fields', () => {
      it.each([
        ['openai', 'apiKey', 'OPENAI_API_KEY'],
        ['claude', 'apiKey', 'CLAUDE_API_KEY'],
        ['perplexity', 'apiKey', 'PERPLEXITY_API_KEY'],
        ['deepseek', 'apiKey', 'DEEPSEEK_API_KEY'],
        ['qwen', 'apiKey', 'QWEN_API_KEY'],
        ['yandex', 'apiKey', 'YANDEX_API_KEY'],
        ['yandex', 'folder_id', 'YANDEX_FOLDER_ID'],
      ])('fills %s.%s from env when DB record has no value for it', (provider, field, envVar) => {
        const merged = {userId: 'u1', model: 'auto'}
        const {settings} = withEnv({[envVar]: 'sk-env-value'}, () =>
          resolveSettings({merged, workflowDoc: null, userId: 'u1', workflowId: null}),
        )
        expect(settings[provider][field]).toBe('sk-env-value')
      })

      it('fills both yandex fields simultaneously when both env vars are set', () => {
        const merged = {userId: 'u1', model: 'auto'}
        const {settings} = withEnv({YANDEX_API_KEY: 'sk-env-yandex', YANDEX_FOLDER_ID: 'folder-env'}, () =>
          resolveSettings({merged, workflowDoc: null, userId: 'u1', workflowId: null}),
        )
        expect(settings.yandex.apiKey).toBe('sk-env-yandex')
        expect(settings.yandex.folder_id).toBe('folder-env')
      })

      it('fills only the absent yandex field when the other is already present in DB', () => {
        const merged = {userId: 'u1', model: 'auto', yandex: {apiKey: 'sk-db-yandex'}}
        const {settings} = withEnv({YANDEX_API_KEY: 'sk-env-yandex', YANDEX_FOLDER_ID: 'folder-env'}, () =>
          resolveSettings({merged, workflowDoc: null, userId: 'u1', workflowId: null}),
        )
        expect(settings.yandex.apiKey).toBe('sk-db-yandex')
        expect(settings.yandex.folder_id).toBe('folder-env')
      })

      it('fills only the absent yandex field when the other direction is absent', () => {
        const merged = {userId: 'u1', model: 'auto', yandex: {folder_id: 'folder-db'}}
        const {settings} = withEnv({YANDEX_API_KEY: 'sk-env-yandex', YANDEX_FOLDER_ID: 'folder-env'}, () =>
          resolveSettings({merged, workflowDoc: null, userId: 'u1', workflowId: null}),
        )
        expect(settings.yandex.folder_id).toBe('folder-db')
        expect(settings.yandex.apiKey).toBe('sk-env-yandex')
      })

      it.each([
        ['openai', 'OPENAI_API_KEY'],
        ['claude', 'CLAUDE_API_KEY'],
        ['perplexity', 'PERPLEXITY_API_KEY'],
        ['deepseek', 'DEEPSEEK_API_KEY'],
        ['qwen', 'QWEN_API_KEY'],
        ['yandex', 'YANDEX_API_KEY'],
      ])('does not create %s sub-object when its env var is absent', (provider, envVar) => {
        const merged = {userId: 'u1', model: 'auto'}
        const {settings} = withEnv({[envVar]: undefined}, () =>
          resolveSettings({merged, workflowDoc: null, userId: 'u1', workflowId: null}),
        )
        expect(settings[provider]).toBeUndefined()
      })
    })

    describe('DB-supplied credentials take precedence over env', () => {
      it.each([
        ['openai', 'apiKey', 'OPENAI_API_KEY', 'sk-db-openai'],
        ['claude', 'apiKey', 'CLAUDE_API_KEY', 'sk-db-claude'],
        ['perplexity', 'apiKey', 'PERPLEXITY_API_KEY', 'sk-db-perplexity'],
        ['deepseek', 'apiKey', 'DEEPSEEK_API_KEY', 'sk-db-deepseek'],
        ['qwen', 'apiKey', 'QWEN_API_KEY', 'sk-db-qwen'],
        ['yandex', 'apiKey', 'YANDEX_API_KEY', 'sk-db-yandex'],
        ['yandex', 'folder_id', 'YANDEX_FOLDER_ID', 'folder-db'],
      ])('does not overwrite truthy %s.%s with env var', (provider, field, envVar, dbValue) => {
        const merged = {userId: 'u1', model: 'auto', [provider]: {[field]: dbValue}}
        const {settings} = withEnv({[envVar]: 'sk-env-value'}, () =>
          resolveSettings({merged, workflowDoc: null, userId: 'u1', workflowId: null}),
        )
        expect(settings[provider][field]).toBe(dbValue)
      })
    })

    describe('falsy DB credential values are treated as absent and filled by env', () => {
      it.each([
        ['null', null],
        ['empty string', ''],
        ['whitespace-only string', '   '],
        ['undefined', undefined],
      ])('%s credential is overwritten by env var', (_, credentialValue) => {
        const merged = {userId: 'u1', model: 'auto', openai: {apiKey: credentialValue}}
        const {settings} = withEnv({OPENAI_API_KEY: 'sk-env-fill'}, () =>
          resolveSettings({merged, workflowDoc: null, userId: 'u1', workflowId: null}),
        )
        expect(settings.openai.apiKey).toBe('sk-env-fill')
      })
    })

    it('does not modify workflowDoc when filling absent credentials in merged', () => {
      const merged = {userId: 'u1', model: 'auto'}
      const workflowDoc = {userId: 'u1', workflowId: 'wf-1'}
      const workflowDocSnapshot = JSON.parse(JSON.stringify(workflowDoc))
      withEnv({OPENAI_API_KEY: 'sk-env'}, () =>
        resolveSettings({merged, workflowDoc, userId: 'u1', workflowId: 'wf-1'}),
      )
      expect(workflowDoc).toEqual(workflowDocSnapshot)
    })
  })

  describe('when merged is null (no DB record)', () => {
    describe('base settings structure', () => {
      it('model field is set to USER_DEFAULT_MODEL', () => {
        const {settings} = withEnv({OPENAI_API_KEY: 'sk-any'}, () => resolveSettings(nullDbArgs))
        expect(settings.model).toBe(USER_DEFAULT_MODEL)
      })

      it('userId is preserved from input', () => {
        const {settings} = withEnv({OPENAI_API_KEY: 'sk-any'}, () =>
          resolveSettings({...nullDbArgs, userId: 'my-user'}),
        )
        expect(settings.userId).toBe('my-user')
      })

      it('workflowId is preserved from input', () => {
        const {settings} = withEnv({OPENAI_API_KEY: 'sk-any'}, () =>
          resolveSettings({...nullDbArgs, workflowId: 'my-wf'}),
        )
        expect(settings.workflowId).toBe('my-wf')
      })

      it('passes workflowDoc through by reference even when merged is null', () => {
        const workflowDoc = {userId: 'u1', workflowId: 'wf-1', claude: {apiKey: 'sk-wf'}}
        const result = withEnv({OPENAI_API_KEY: 'sk-any'}, () =>
          resolveSettings({merged: null, workflowDoc, userId: 'u1', workflowId: 'wf-1'}),
        )
        expect(result.workflowDoc).toBe(workflowDoc)
      })
    })

    describe('env fallback populates provider credentials', () => {
      it.each([
        ['openai', 'apiKey', 'OPENAI_API_KEY', 'sk-env-openai'],
        ['claude', 'apiKey', 'CLAUDE_API_KEY', 'sk-env-claude'],
        ['perplexity', 'apiKey', 'PERPLEXITY_API_KEY', 'sk-env-perplexity'],
        ['deepseek', 'apiKey', 'DEEPSEEK_API_KEY', 'sk-env-deepseek'],
        ['qwen', 'apiKey', 'QWEN_API_KEY', 'sk-env-qwen'],
        ['yandex', 'apiKey', 'YANDEX_API_KEY', 'sk-env-yandex'],
        ['yandex', 'folder_id', 'YANDEX_FOLDER_ID', 'folder-env'],
      ])('populates %s.%s from %s', (provider, field, envVar, envValue) => {
        const {settings} = withEnv({[envVar]: envValue}, () => resolveSettings(nullDbArgs))
        expect(settings[provider][field]).toBe(envValue)
      })

      it('fills both yandex fields simultaneously when both env vars are set', () => {
        const {settings} = withEnv({YANDEX_API_KEY: 'sk-env-yandex', YANDEX_FOLDER_ID: 'folder-env'}, () =>
          resolveSettings(nullDbArgs),
        )
        expect(settings.yandex.apiKey).toBe('sk-env-yandex')
        expect(settings.yandex.folder_id).toBe('folder-env')
      })

      it('populates multiple providers independently when multiple env vars are set', () => {
        const {settings} = withEnv({OPENAI_API_KEY: 'sk-openai', CLAUDE_API_KEY: 'sk-claude'}, () =>
          resolveSettings(nullDbArgs),
        )
        expect(settings.openai.apiKey).toBe('sk-openai')
        expect(settings.claude.apiKey).toBe('sk-claude')
      })

      it('does not create sub-objects for providers whose env vars are absent', () => {
        const {settings} = withEnv({...ALL_PROVIDER_ENV_VARS_ABSENT, OPENAI_API_KEY: 'sk-openai'}, () =>
          resolveSettings(nullDbArgs),
        )
        ;['claude', 'perplexity', 'deepseek', 'qwen', 'yandex'].forEach(provider =>
          expect(settings[provider]).toBeUndefined(),
        )
      })
    })

    describe('throw condition', () => {
      it('throws when no provider env vars are set', () => {
        expect(() => withEnv(ALL_PROVIDER_ENV_VARS_ABSENT, () => resolveSettings(nullDbArgs))).toThrow(
          'No LLM credentials configured',
        )
      })

      it('error message names every provider env var including YANDEX_FOLDER_ID', () => {
        let thrown
        try {
          withEnv(ALL_PROVIDER_ENV_VARS_ABSENT, () => resolveSettings(nullDbArgs))
        } catch (e) {
          thrown = e
        }
        ;[
          'OPENAI_API_KEY',
          'CLAUDE_API_KEY',
          'DEEPSEEK_API_KEY',
          'QWEN_API_KEY',
          'PERPLEXITY_API_KEY',
          'YANDEX_API_KEY',
          'YANDEX_FOLDER_ID',
        ].forEach(name => expect(thrown.message).toContain(name))
      })

      it.each([
        ['whitespace-only', '   '],
        ['empty string', ''],
      ])('throws when only a %s env var value is set', (_, value) => {
        expect(() =>
          withEnv({...ALL_PROVIDER_ENV_VARS_ABSENT, OPENAI_API_KEY: value}, () => resolveSettings(nullDbArgs)),
        ).toThrow('No LLM credentials configured')
      })

      it.each([
        ['OPENAI_API_KEY', 'sk-openai'],
        ['CLAUDE_API_KEY', 'sk-claude'],
        ['PERPLEXITY_API_KEY', 'sk-perplexity'],
        ['DEEPSEEK_API_KEY', 'sk-deepseek'],
        ['QWEN_API_KEY', 'sk-qwen'],
        ['YANDEX_API_KEY', 'sk-yandex'],
        ['YANDEX_FOLDER_ID', 'folder-yandex'],
      ])('does not throw when only %s is set to a non-blank value', (envVar, value) => {
        expect(() =>
          withEnv({...ALL_PROVIDER_ENV_VARS_ABSENT, [envVar]: value}, () => resolveSettings(nullDbArgs)),
        ).not.toThrow()
      })
    })
  })

  describe('MOCK_EXTERNAL_SERVICES gate', () => {
    it('skips the no-credentials throw when MOCK_EXTERNAL_SERVICES=true', () => {
      expect(() =>
        withEnv({...ALL_PROVIDER_ENV_VARS_ABSENT, MOCK_EXTERNAL_SERVICES: 'true'}, () => resolveSettings(nullDbArgs)),
      ).not.toThrow()
    })

    it('returns a usable settings object with the default model when in mock mode', () => {
      const {settings} = withEnv({...ALL_PROVIDER_ENV_VARS_ABSENT, MOCK_EXTERNAL_SERVICES: 'true'}, () =>
        resolveSettings(nullDbArgs),
      )
      expect(settings.userId).toBe('u1')
      expect(settings.model).toBeDefined()
    })

    it.each(['development', 'qa', 'e2e', 'production', undefined])(
      'refuses mock settings synthesis in non-allowlisted runtime NODE_ENV=%s',
      nodeEnv => {
        expect(() =>
          withEnv({...ALL_PROVIDER_ENV_VARS_ABSENT, MOCK_EXTERNAL_SERVICES: 'true', NODE_ENV: nodeEnv}, () =>
            resolveSettings(nullDbArgs),
          ),
        ).toThrow(/MOCK_EXTERNAL_SERVICES=true/)
      },
    )

    it.each(['development', 'qa', 'e2e'])(
      'explicit allow env permits mock settings synthesis in runtime NODE_ENV=%s',
      nodeEnv => {
        expect(() =>
          withEnv(
            {
              ...ALL_PROVIDER_ENV_VARS_ABSENT,
              MOCK_EXTERNAL_SERVICES: 'true',
              NODE_ENV: nodeEnv,
              [MOCK_EXTERNAL_SERVICES_ALLOW_ENV]: 'true',
            },
            () => resolveSettings(nullDbArgs),
          ),
        ).not.toThrow()
      },
    )

    it.each(['false', '', '1', 'TRUE', undefined])(
      'still enforces credential presence when MOCK_EXTERNAL_SERVICES=%s (strict "true" gate)',
      value => {
        expect(() =>
          withEnv({...ALL_PROVIDER_ENV_VARS_ABSENT, MOCK_EXTERNAL_SERVICES: value}, () => resolveSettings(nullDbArgs)),
        ).toThrow(/No LLM credentials configured/)
      },
    )
  })
})

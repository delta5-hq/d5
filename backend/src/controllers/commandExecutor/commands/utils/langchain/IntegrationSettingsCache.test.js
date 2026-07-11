import {
  buildIntegrationSettingsCacheKey,
  getCachedIntegrationSettings,
  hasCachedIntegrationSettings,
  setCachedIntegrationSettings,
} from './IntegrationSettingsCache'

describe('IntegrationSettingsCache', () => {
  describe('cache key', () => {
    it.each([
      ['user scope', 'user-1', null, 'user-1:__global__'],
      ['undefined workflow scope', 'user-1', undefined, 'user-1:__global__'],
      ['empty workflow scope', 'user-1', '', 'user-1:__global__'],
      ['workflow scope', 'user-1', 'wf-1', 'user-1:wf-1'],
      ['numeric identifiers', 1, 2, '1:2'],
      ['zero workflow id', 'user-1', 0, 'user-1:0'],
      ['empty user id', '', 'wf-1', '__empty__:wf-1'],
    ])('builds a stable key for %s', (_caseName, userId, workflowId, expectedKey) => {
      expect(buildIntegrationSettingsCacheKey(userId, workflowId)).toBe(expectedKey)
    })
  })

  describe('settings storage', () => {
    const cacheCases = [
      ['different workflow scopes', ['user-1', 'wf-1'], ['user-1', 'wf-2']],
      ['user scope and workflow scope', ['user-1', null], ['user-1', 'wf-1']],
      ['different users sharing workflow id', ['user-1', 'wf-1'], ['user-2', 'wf-1']],
    ]

    it.each(cacheCases)('keeps settings isolated for %s', (_caseName, firstScope, secondScope) => {
      const store = {}
      const firstSettings = {model: 'OpenAI'}
      const secondSettings = {model: 'Claude'}

      setCachedIntegrationSettings(store, firstScope[0], firstScope[1], firstSettings)
      setCachedIntegrationSettings(store, secondScope[0], secondScope[1], secondSettings)

      expect(getCachedIntegrationSettings(store, firstScope[0], firstScope[1])).toBe(firstSettings)
      expect(getCachedIntegrationSettings(store, secondScope[0], secondScope[1])).toBe(secondSettings)
    })

    it('returns undefined when a scope was not cached', () => {
      const store = {}

      setCachedIntegrationSettings(store, 'user-1', 'wf-1', {
        model: 'OpenAI',
      })

      expect(getCachedIntegrationSettings(store, 'user-1', 'wf-2')).toBeUndefined()
      expect(hasCachedIntegrationSettings(store, 'user-1', 'wf-2')).toBe(false)
    })

    it('distinguishes cached undefined from a missing scope', () => {
      const store = {}

      setCachedIntegrationSettings(store, 'user-1', 'wf-1', undefined)

      expect(getCachedIntegrationSettings(store, 'user-1', 'wf-1')).toBeUndefined()
      expect(hasCachedIntegrationSettings(store, 'user-1', 'wf-1')).toBe(true)
    })

    it('returns the stored settings from setCachedIntegrationSettings', () => {
      const settings = {model: 'OpenAI'}

      expect(setCachedIntegrationSettings({}, 'user-1', 'wf-1', settings)).toBe(settings)
    })

    it('bypasses cache operations when store is absent', () => {
      const settings = {model: 'OpenAI'}

      expect(getCachedIntegrationSettings(null, 'user-1', 'wf-1')).toBeUndefined()
      expect(hasCachedIntegrationSettings(null, 'user-1', 'wf-1')).toBe(false)
      expect(setCachedIntegrationSettings(null, 'user-1', 'wf-1', settings)).toBe(settings)
    })
  })
})

const CACHE_PROPERTY = '_integrationSettingsCache'
const GLOBAL_SCOPE = '__global__'
const EMPTY_ID = '__empty__'

const isGlobalWorkflowScope = workflowId => workflowId === null || workflowId === undefined || workflowId === ''

const normalizeScopePart = value => {
  if (value === null || value === undefined || value === '') return EMPTY_ID
  return String(value)
}

export const buildIntegrationSettingsCacheKey = (userId, workflowId = null) =>
  [normalizeScopePart(userId), isGlobalWorkflowScope(workflowId) ? GLOBAL_SCOPE : normalizeScopePart(workflowId)].join(
    ':',
  )

const getCache = store => {
  if (!store) return null
  if (!(store[CACHE_PROPERTY] instanceof Map)) {
    store[CACHE_PROPERTY] = new Map()
  }
  return store[CACHE_PROPERTY]
}

export const getCachedIntegrationSettings = (store, userId, workflowId = null) => {
  const cache = getCache(store)
  if (!cache) return undefined
  return cache.get(buildIntegrationSettingsCacheKey(userId, workflowId))
}

export const hasCachedIntegrationSettings = (store, userId, workflowId = null) => {
  const cache = getCache(store)
  if (!cache) return false
  return cache.has(buildIntegrationSettingsCacheKey(userId, workflowId))
}

export const setCachedIntegrationSettings = (store, userId, workflowId = null, settings) => {
  const cache = getCache(store)
  if (!cache) return settings
  cache.set(buildIntegrationSettingsCacheKey(userId, workflowId), settings)
  return settings
}

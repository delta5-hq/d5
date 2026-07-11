const PROVIDER_FIELDS = ['openai', 'claude', 'yandex', 'deepseek', 'qwen', 'perplexity', 'custom_llm', 'google']

const SENTINEL_VALUES = {
  lang: 'none',
  model: 'auto',
}

const SENTINEL_FIELDS = ['lang', 'model']

const ARRAY_FIELDS = ['mcp', 'rpc']

const isPresent = value => value !== null && value !== undefined

const isSentinelValue = (field, value) => {
  const sentinel = SENTINEL_VALUES[field]
  return sentinel !== undefined && value === sentinel
}

const isEmptyObject = obj => typeof obj === 'object' && obj !== null && Object.keys(obj).length === 0

const mergeProviderObject = (globalObj, workflowObj) => {
  if (!globalObj) return workflowObj
  if (!workflowObj) return globalObj
  if (isEmptyObject(workflowObj)) return workflowObj
  const result = {...globalObj}
  for (const [key, value] of Object.entries(workflowObj)) {
    if (value !== null && value !== undefined) {
      result[key] = value
    }
  }
  return result
}

const mergeSentinelField = (field, globalValue, workflowValue) => {
  if (isPresent(workflowValue) && !isSentinelValue(field, workflowValue)) {
    return workflowValue
  }
  return globalValue
}

const mergeArrayField = (globalArray, workflowArray) => {
  const globalItems = globalArray || []
  const workflowItems = workflowArray || []

  const combined = [...globalItems]

  for (const workflowItem of workflowItems) {
    const existingIndex = combined.findIndex(item => item.alias === workflowItem.alias)
    if (existingIndex >= 0) {
      combined[existingIndex] = workflowItem
    } else {
      combined.push(workflowItem)
    }
  }

  return combined
}

export class IntegrationMerger {
  merge(appWide, workflow) {
    if (!appWide && !workflow) return null
    if (!appWide) return workflow
    if (!workflow) return appWide

    return {
      ...this._mergeIdentityFields(appWide, workflow),
      ...this._mergeLLMProviders(appWide, workflow),
      ...this._mergeAliasArrays(appWide, workflow),
    }
  }

  _mergeIdentityFields(appWide, workflow) {
    return {
      userId: workflow.userId,
      workflowId: workflow.workflowId,
      model: mergeSentinelField('model', appWide.model, workflow.model),
      lang: mergeSentinelField('lang', appWide.lang, workflow.lang),
    }
  }

  _mergeLLMProviders(appWide, workflow) {
    const merged = {}

    for (const provider of PROVIDER_FIELDS) {
      const mergedProvider = mergeProviderObject(appWide[provider], workflow[provider])
      if (isPresent(mergedProvider)) {
        merged[provider] = mergedProvider
      }
    }

    return merged
  }

  _mergeAliasArrays(appWide, workflow) {
    return {
      mcp: this._unionMergeArray(appWide.mcp, workflow.mcp),
      rpc: this._unionMergeArray(appWide.rpc, workflow.rpc),
    }
  }

  _unionMergeArray(appArray, workflowArray) {
    const app = appArray || []

    if (workflowArray === undefined) {
      return app
    }

    const wf = workflowArray || []

    if (Array.isArray(workflowArray) && wf.length === 0) {
      return []
    }

    if (app.length === 0) return wf

    const workflowByAlias = new Map()
    for (const item of wf) {
      if (item.alias) {
        workflowByAlias.set(item.alias, item)
      }
    }

    const merged = [...wf]
    for (const item of app) {
      if (!item.alias || !workflowByAlias.has(item.alias)) {
        merged.push(item)
      }
    }

    return merged
  }
}

export default new IntegrationMerger()

export const mergeIntegrations = (globalDoc, workflowDoc) => {
  if (!globalDoc && !workflowDoc) {
    return null
  }

  if (!globalDoc) {
    return workflowDoc
  }

  if (!workflowDoc) {
    return globalDoc
  }

  const merged = {
    userId: workflowDoc.userId || globalDoc.userId,
    workflowId: workflowDoc.workflowId,
  }

  for (const field of PROVIDER_FIELDS) {
    const mergedValue = mergeProviderObject(globalDoc[field], workflowDoc[field])
    if (isPresent(mergedValue)) {
      merged[field] = mergedValue
    }
  }

  for (const field of SENTINEL_FIELDS) {
    const mergedValue = mergeSentinelField(field, globalDoc[field], workflowDoc[field])
    if (isPresent(mergedValue)) {
      merged[field] = mergedValue
    }
  }

  for (const field of ARRAY_FIELDS) {
    const mergedValue = mergeArrayField(globalDoc[field], workflowDoc[field])
    if (mergedValue.length > 0) {
      merged[field] = mergedValue
    }
  }

  return merged
}

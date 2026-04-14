export class IntegrationMerger {
  merge(appWide, workflow) {
    if (!appWide && !workflow) return null
    if (!appWide) return workflow
    if (!workflow) return appWide

    return {
      ...this._mergeScalarFields(appWide, workflow),
      ...this._mergeLLMProviders(appWide, workflow),
      ...this._mergeAliasArrays(appWide, workflow),
    }
  }

  _mergeScalarFields(appWide, workflow) {
    return {
      userId: workflow.userId,
      workflowId: workflow.workflowId,
      model: workflow.model ?? appWide.model,
      lang: workflow.lang ?? appWide.lang,
    }
  }

  _mergeLLMProviders(appWide, workflow) {
    const llmProviders = ['openai', 'claude', 'yandex', 'qwen', 'deepseek', 'perplexity', 'custom_llm', 'google']
    const merged = {}

    for (const provider of llmProviders) {
      const appProvider = appWide[provider]
      const workflowProvider = workflow[provider]

      if (!appProvider && !workflowProvider) continue
      if (!appProvider) {
        merged[provider] = workflowProvider
        continue
      }
      if (!workflowProvider) {
        merged[provider] = appProvider
        continue
      }

      merged[provider] = this._mergeProviderObject(appProvider, workflowProvider)
    }

    return merged
  }

  _mergeProviderObject(appProvider, workflowProvider) {
    const merged = {...appProvider}

    for (const [key, value] of Object.entries(workflowProvider)) {
      if (value !== undefined && value !== null) {
        merged[key] = value
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

const SENTINEL_VALUES = {
  lang: 'none',
  model: 'auto',
}

const SCALAR_FIELDS = ['openai', 'claude', 'yandex', 'deepseek', 'qwen', 'perplexity', 'custom_llm', 'google']

const SENTINEL_FIELDS = ['lang', 'model']

const ARRAY_FIELDS = ['mcp', 'rpc']

const isPresent = value => value !== null && value !== undefined

const isSentinelValue = (field, value) => {
  const sentinel = SENTINEL_VALUES[field]
  return sentinel !== undefined && value === sentinel
}

const mergeScalarField = (globalValue, workflowValue) => {
  if (isPresent(workflowValue)) {
    return workflowValue
  }
  return globalValue
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

  for (const field of SCALAR_FIELDS) {
    const mergedValue = mergeScalarField(globalDoc[field], workflowDoc[field])
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

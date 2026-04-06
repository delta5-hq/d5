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

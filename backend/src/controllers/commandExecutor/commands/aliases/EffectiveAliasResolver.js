export class EffectiveAliasResolver {
  resolveOtherType(service, {appWide, workflow}) {
    const otherType = service === 'mcp' ? 'rpc' : 'mcp'
    const globalItems = appWide?.[otherType] || []
    const workflowField = workflow?.[otherType]
    if (Array.isArray(workflowField) && workflowField.length === 0) return []
    const workflowItems = workflowField || []
    return this._workflowOverridesGlobal(globalItems, workflowItems)
  }

  _workflowOverridesGlobal(globalItems, workflowItems) {
    if (!workflowItems.length) return globalItems
    const workflowAliases = new Set(workflowItems.map(i => i.alias))
    return [...workflowItems, ...globalItems.filter(i => !workflowAliases.has(i.alias))]
  }
}

export default new EffectiveAliasResolver()

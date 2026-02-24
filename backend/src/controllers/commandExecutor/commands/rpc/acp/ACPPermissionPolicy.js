export class ACPPermissionPolicy {
  constructor({allowedTools = [], denyAll = false, allowAll = false}) {
    if (allowAll && denyAll) {
      throw new Error('Cannot set both allowAll and denyAll')
    }

    this.allowedTools = new Set(allowedTools)
    this.denyAll = denyAll
    this.allowAll = allowAll
  }

  shouldApprove(toolName) {
    if (this.allowAll) return true
    if (this.denyAll) return false
    return this.allowedTools.has(toolName)
  }

  buildResponse(toolName, options) {
    const isApproved = this.shouldApprove(toolName)
    const optionId =
      options.find(opt => {
        if (isApproved) return opt.kind === 'allow_once' || opt.kind === 'allow_always'
        return opt.kind === 'reject_once' || opt.kind === 'reject_always'
      })?.optionId || options[0]?.optionId

    return {outcome: {outcome: 'selected', optionId}}
  }

  static fromIntegrationConfig(config) {
    const {autoApprove, allowedTools} = config

    if (autoApprove === 'all') {
      return new ACPPermissionPolicy({allowAll: true})
    }

    if (autoApprove === 'none') {
      return new ACPPermissionPolicy({denyAll: true})
    }

    return new ACPPermissionPolicy({allowedTools: allowedTools || []})
  }
}

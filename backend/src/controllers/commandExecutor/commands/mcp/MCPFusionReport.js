const formatError = error => (error instanceof Error ? error.message : String(error || 'Unknown error'))

const formatToolList = tools => (tools.length ? tools.join(', ') : 'no tools')

export class MCPFusionReport {
  constructor() {
    this.available = []
    this.unavailable = []
    this.toolCalls = []
  }

  markAvailable(alias, toolNames) {
    this.available.push({alias, toolNames: [...toolNames]})
  }

  markUnavailable(alias, phase, error) {
    this.unavailable.push({alias, phase, reason: formatError(error)})
  }

  recordToolCall(alias, exposedName, toolName, status, error) {
    this.toolCalls.push({alias, exposedName, toolName, status, reason: error ? formatError(error) : undefined})
  }

  render(answer) {
    const body = answer || '(empty MCP response)'
    const sections = [body]
    const availability = this.renderAvailability()
    const provenance = this.renderProvenance()

    if (availability) sections.push(availability)
    if (provenance) sections.push(provenance)

    return sections.join('\n\n')
  }

  renderAvailability() {
    const lines = []

    if (this.available.length) {
      lines.push('Available MCP integrations:')
      this.available.forEach(({alias, toolNames}) => {
        lines.push(`- ${alias}: ${formatToolList(toolNames)}`)
      })
    }

    if (this.unavailable.length) {
      lines.push('Unavailable MCP integrations:')
      this.unavailable.forEach(({alias, phase, reason}) => {
        lines.push(`- ${alias}: ${phase} failed — ${reason}`)
      })
    }

    return lines.length ? lines.join('\n') : ''
  }

  renderProvenance() {
    if (!this.toolCalls.length) return 'Tool calls: none'

    const lines = ['Tool calls:']
    this.toolCalls.forEach(({alias, exposedName, toolName, status, reason}) => {
      const suffix = reason ? ` — ${reason}` : ''
      lines.push(`- ${alias} ${exposedName} → ${toolName}: ${status}${suffix}`)
    })
    return lines.join('\n')
  }

  toJSON() {
    return {
      available: this.available.map(e => ({...e, toolNames: [...e.toolNames]})),
      unavailable: this.unavailable.map(e => ({...e})),
      toolCalls: this.toolCalls.map(e => ({...e})),
    }
  }
}

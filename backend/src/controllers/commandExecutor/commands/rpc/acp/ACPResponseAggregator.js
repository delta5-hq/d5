export class ACPResponseAggregator {
  constructor() {
    this.textChunks = []
    this.toolCalls = new Map()
    this.sessionId = null
  }

  processUpdate(notification) {
    if (!notification?.update) return

    const {update} = notification

    switch (update.sessionUpdate) {
      case 'agent_message_chunk':
        if (update.content?.type === 'text') {
          this.textChunks.push(update.content.text || '')
        }
        break

      case 'tool_call':
        this.toolCalls.set(update.toolCallId, {
          id: update.toolCallId,
          name: update.name,
          title: update.title || update.name,
          status: update.status || 'pending',
        })
        break

      case 'tool_call_update':
        if (this.toolCalls.has(update.toolCallId)) {
          const existing = this.toolCalls.get(update.toolCallId)
          this.toolCalls.set(update.toolCallId, {
            ...existing,
            status: update.status || existing.status,
          })
        }
        break

      default:
        break
    }
  }

  extractSessionId(notifications) {
    for (const notification of notifications) {
      if (notification?.sessionId) {
        this.sessionId = notification.sessionId
        return notification.sessionId
      }
    }
    return null
  }

  getText() {
    return this.textChunks.join('')
  }

  getToolCallsSummary() {
    const calls = Array.from(this.toolCalls.values())
    if (calls.length === 0) return ''

    const lines = calls.map(call => `[Tool: ${call.title}] ${call.status}`)
    return '\n\n' + lines.join('\n')
  }

  getFullResponse() {
    const text = this.getText()
    const toolSummary = this.getToolCallsSummary()
    return text + toolSummary
  }

  getSessionId() {
    return this.sessionId
  }
}

export class SessionIdInjector {
  constructor(commandTemplate, lastSessionId) {
    this.commandTemplate = commandTemplate
    this.lastSessionId = lastSessionId
  }

  inject() {
    if (!this.commandTemplate) {
      return ''
    }

    if (!this.lastSessionId) {
      return this.removeSessionIdPlaceholders(this.commandTemplate)
    }

    return this.commandTemplate.replace(/\{\{sessionId\}\}/g, this.lastSessionId)
  }

  removeSessionIdPlaceholders(template) {
    return template
      .replace(/\s*--resume\s+\{\{sessionId\}\}/g, '')
      .replace(/\s*-r\s+\{\{sessionId\}\}/g, '')
      .replace(/\{\{sessionId\}\}/g, '')
  }
}

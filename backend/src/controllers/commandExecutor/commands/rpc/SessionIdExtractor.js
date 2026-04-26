export class SessionIdExtractor {
  constructor(outputFormat, outputField) {
    this.outputFormat = outputFormat
    this.outputField = outputField
  }

  extract(rawOutput) {
    if (this.outputFormat !== 'json') {
      return null
    }

    try {
      const parsed = JSON.parse(rawOutput)
      return this.extractFromParsed(parsed)
    } catch {
      return null
    }
  }

  extractFromParsed(parsed) {
    const sessionIdField = this.outputField || 'session_id'
    return this.getNestedValue(parsed, sessionIdField)
  }

  getNestedValue(obj, path) {
    if (!path) return null

    const parts = path.split('.')
    let current = obj

    for (const part of parts) {
      if (current === null || current === undefined) return null
      current = current[part]
    }

    return typeof current === 'string' ? current : null
  }
}

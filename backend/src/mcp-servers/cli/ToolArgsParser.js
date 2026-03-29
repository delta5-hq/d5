export class ToolArgsParser {
  parse(args) {
    const toolArgs = {}

    for (const arg of args) {
      if (!arg.startsWith('--')) continue

      const withoutPrefix = arg.slice(2)
      const equalsIndex = withoutPrefix.indexOf('=')

      if (equalsIndex === -1) {
        const key = withoutPrefix
        toolArgs[key] = true
        continue
      }

      const key = withoutPrefix.slice(0, equalsIndex)
      const rawValue = withoutPrefix.slice(equalsIndex + 1)

      toolArgs[key] = this._coerceValue(rawValue)
    }

    return toolArgs
  }

  _coerceValue(rawValue) {
    const unquoted = this._stripMatchingQuotes(rawValue)

    if (unquoted === 'true') return true
    if (unquoted === 'false') return false

    if (this._isNumericString(unquoted)) {
      return Number(unquoted)
    }

    const parsed = this._attemptJsonParse(unquoted)
    if (parsed !== null) return parsed

    return unquoted
  }

  _stripMatchingQuotes(str) {
    if (str.length < 2) return str

    const first = str[0]
    const last = str[str.length - 1]

    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return str.slice(1, -1)
    }

    return str
  }

  _isNumericString(str) {
    return /^-?\d+(\.\d+)?$/.test(str)
  }

  _attemptJsonParse(str) {
    if (!str.startsWith('[') && !str.startsWith('{')) return null

    try {
      const parsed = JSON.parse(str)
      if (typeof parsed === 'object') return parsed
    } catch (e) {
      return null
    }

    return null
  }
}

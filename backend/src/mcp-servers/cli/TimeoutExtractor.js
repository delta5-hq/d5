export class TimeoutExtractor {
  extract(args) {
    const timeoutArgs = args.filter(arg => arg === '--timeout' || arg.startsWith('--timeout='))

    if (timeoutArgs.length === 0) {
      return {
        hasTimeout: false,
        timeoutMs: null,
        remainingArgs: args,
        error: null,
      }
    }

    const lastTimeoutArg = timeoutArgs[timeoutArgs.length - 1]
    const validation = this._validate(lastTimeoutArg)

    if (validation.error) {
      return {
        hasTimeout: true,
        timeoutMs: null,
        remainingArgs: args,
        error: validation.error,
      }
    }

    const remainingArgs = args.filter(arg => arg !== '--timeout' && !arg.startsWith('--timeout='))

    return {
      hasTimeout: true,
      timeoutMs: validation.value,
      remainingArgs,
      error: null,
    }
  }

  _validate(arg) {
    if (arg === '--timeout') {
      return {
        error: '--timeout requires a value (e.g., --timeout=30000)',
      }
    }

    const equalsIndex = arg.indexOf('=')
    if (equalsIndex === -1) {
      return {
        error: '--timeout requires a value (e.g., --timeout=30000)',
      }
    }

    const rawValue = arg.slice(equalsIndex + 1)
    const unquoted = this._stripQuotes(rawValue)

    if (unquoted === '') {
      return {
        error: '--timeout value cannot be empty',
      }
    }

    if (!this._isPositiveInteger(unquoted)) {
      return {
        error: `--timeout must be a positive integer, got: ${unquoted}`,
      }
    }

    const timeoutMs = parseInt(unquoted, 10)

    return {
      value: timeoutMs,
      error: null,
    }
  }

  _stripQuotes(str) {
    if (str.length < 2) return str

    const first = str[0]
    const last = str[str.length - 1]

    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return str.slice(1, -1)
    }

    return str
  }

  _isPositiveInteger(str) {
    if (!/^\d+$/.test(str)) return false

    const num = parseInt(str, 10)
    return num > 0 && Number.isFinite(num) && Number.isSafeInteger(num)
  }
}

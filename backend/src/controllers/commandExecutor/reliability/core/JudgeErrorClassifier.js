const QUOTA_PATTERNS = [
  /\b429\b/,
  /quota[_\s]?exceeded/i,
  /rate[_\s]?limit/i,
  /too many requests/i,
  /insufficient[_\s]quota/i,
  /request limit/i,
]

const AUTH_PATTERNS = [
  /\b401\b/,
  /\b403\b/,
  /unauthorized/i,
  /authentication[_\s]?failed/i,
  /invalid[_\s]?api[_\s]?key/i,
  /incorrect[_\s]?api[_\s]?key/i,
  /invalid_api_key/i,
  /permission[_\s]?denied/i,
  /access[_\s]?denied/i,
]

export class JudgeNonTransientError extends Error {
  constructor(reason, cause) {
    super(cause.message)
    this.name = 'JudgeNonTransientError'
    this.reason = reason
    this.cause = cause
  }
}

export class JudgeErrorClassifier {
  static classify(error) {
    const message = String(error?.message ?? error ?? '')
    if (QUOTA_PATTERNS.some(p => p.test(message))) return 'quota'
    if (AUTH_PATTERNS.some(p => p.test(message))) return 'auth'
    return 'transient'
  }

  static wrapIfNonTransient(error) {
    const type = this.classify(error)
    if (type === 'transient') return null
    const reason = type === 'quota' ? 'judge_quota_error' : 'judge_auth_error'
    return new JudgeNonTransientError(reason, error)
  }
}

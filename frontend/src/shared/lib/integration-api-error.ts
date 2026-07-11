export type IntegrationErrorKind = 'auth' | 'rate_limit' | 'not_found' | 'server_error' | 'unknown'

const AUTH_STATUS_CODES = new Set([401, 403])
const MESSAGE_PATTERNS: Record<IntegrationErrorKind, RegExp[]> = {
  auth: [
    /\b40[13]\b/,
    /unauthorized/i,
    /authentication.{0,10}failed/i,
    /invalid.{0,5}api.?key/i,
    /incorrect.{0,5}api.?key/i,
    /permission.{0,10}denied/i,
    /access.{0,10}denied/i,
  ],
  rate_limit: [/\b429\b/, /rate.?limit/i, /too many requests/i, /quota.{0,10}exceeded/i, /insufficient.{0,10}quota/i],
  not_found: [/\b404\b/, /not found/i],
  server_error: [/\b50[03]\b/, /server error/i, /service unavailable/i],
  unknown: [],
}

function extractHttpStatus(error: unknown): number | undefined {
  if (error === null || error === undefined || typeof error !== 'object') return undefined
  const e = error as Record<string, unknown>

  const directStatus = e['status']
  if (typeof directStatus === 'number') return directStatus

  const response = e['response']
  if (response !== null && response !== undefined && typeof response === 'object') {
    const responseStatus = (response as Record<string, unknown>)['status']
    if (typeof responseStatus === 'number') return responseStatus
  }

  return undefined
}

function classifyByStatus(status: number): IntegrationErrorKind | null {
  if (AUTH_STATUS_CODES.has(status)) return 'auth'
  if (status === 429) return 'rate_limit'
  if (status === 404) return 'not_found'
  if (status === 503 || status === 500) return 'server_error'
  return null
}

function classifyByMessage(message: string): IntegrationErrorKind {
  for (const [kind, patterns] of Object.entries(MESSAGE_PATTERNS) as [IntegrationErrorKind, RegExp[]][]) {
    if (kind === 'unknown') continue
    if (patterns.some(p => p.test(message))) return kind
  }
  return 'unknown'
}

export function classifyIntegrationError(error: unknown): IntegrationErrorKind {
  const status = extractHttpStatus(error)
  if (status !== null && status !== undefined) {
    const byStatus = classifyByStatus(status)
    if (byStatus !== null) return byStatus
  }

  const message = error instanceof Error ? error.message : String(error ?? '')
  return classifyByMessage(message)
}

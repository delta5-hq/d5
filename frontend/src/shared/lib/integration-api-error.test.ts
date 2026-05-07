import { describe, it, expect } from 'vitest'
import { classifyIntegrationError, type IntegrationErrorKind } from './integration-api-error'

const VALID_KINDS: IntegrationErrorKind[] = ['auth', 'rate_limit', 'not_found', 'server_error', 'unknown']

function errorWithResponseStatus(status: number): Error & { response: { status: number } } {
  const e = new Error('http error') as Error & { response: { status: number } }
  e.response = { status }
  return e
}

function errorWithDirectStatus(status: unknown, message = 'sdk error'): Error & { status: unknown } {
  const e = new Error(message) as Error & { status: unknown }
  e.status = status
  return e
}

describe('classifyIntegrationError', () => {
  describe('return type contract', () => {
    it('always returns one of the valid IntegrationErrorKind values', () => {
      const inputs = [
        new Error('something'),
        errorWithResponseStatus(401),
        errorWithDirectStatus(429),
        null,
        undefined,
        'bare string',
        42,
      ]
      inputs.forEach(input => {
        expect(VALID_KINDS).toContain(classifyIntegrationError(input))
      })
    })

    it('is idempotent — same input produces same output across repeated calls', () => {
      const error = errorWithResponseStatus(401)
      const first = classifyIntegrationError(error)
      const second = classifyIntegrationError(error)
      const third = classifyIntegrationError(error)
      expect(first).toBe(second)
      expect(second).toBe(third)
    })

    it('is stateless — prior calls with different inputs do not affect subsequent results', () => {
      classifyIntegrationError(errorWithDirectStatus(429))
      classifyIntegrationError(null)
      classifyIntegrationError(new Error('quota exceeded'))
      expect(classifyIntegrationError(errorWithResponseStatus(401))).toBe('auth')
    })
  })

  describe('HTTP status extraction from error shapes', () => {
    describe('errors carrying status on a nested response object', () => {
      it('reads status from error.response.status', () => {
        expect(classifyIntegrationError(errorWithResponseStatus(401))).toBe('auth')
      })

      it('reads status from response object that carries extra fields alongside status', () => {
        const e = new Error('error') as Error & { response: { status: number; data: string } }
        e.response = { status: 403, data: 'forbidden' }
        expect(classifyIntegrationError(e)).toBe('auth')
      })
    })

    describe('errors carrying status as a top-level field', () => {
      it('reads status from error.status', () => {
        expect(classifyIntegrationError(errorWithDirectStatus(401))).toBe('auth')
      })

      it('reads status from plain object with status field', () => {
        expect(classifyIntegrationError({ status: 429, message: 'rate limited' })).toBe('rate_limit')
      })
    })

    describe('top-level status field takes precedence over response.status', () => {
      it('uses error.status when both error.status and error.response.status are present', () => {
        const e = new Error('error') as Error & { status: number; response: { status: number } }
        e.status = 503
        e.response = { status: 401 }
        expect(classifyIntegrationError(e)).toBe('server_error')
      })

      it('falls back to response.status when top-level status is not a number', () => {
        const e = new Error('error') as Error & { status: unknown; response: { status: number } }
        e.status = '401'
        e.response = { status: 429 }
        expect(classifyIntegrationError(e)).toBe('rate_limit')
      })
    })

    describe('non-numeric status values are ignored and fall through to message classification', () => {
      it('ignores string status field', () => {
        expect(classifyIntegrationError(errorWithDirectStatus('401', 'rate limit exceeded'))).toBe('rate_limit')
      })

      it('ignores null status field', () => {
        expect(classifyIntegrationError(errorWithDirectStatus(null, 'unauthorized'))).toBe('auth')
      })

      it('ignores undefined status field', () => {
        expect(classifyIntegrationError(errorWithDirectStatus(undefined, 'not found'))).toBe('not_found')
      })

      it('ignores NaN status field', () => {
        expect(classifyIntegrationError(errorWithDirectStatus(NaN, 'service unavailable'))).toBe('server_error')
      })

      it('ignores zero status field', () => {
        expect(classifyIntegrationError(errorWithDirectStatus(0, 'unauthorized'))).toBe('auth')
      })

      it('ignores negative status field', () => {
        expect(classifyIntegrationError(errorWithDirectStatus(-1, 'unauthorized'))).toBe('auth')
      })

      it('ignores object status field', () => {
        expect(classifyIntegrationError(errorWithDirectStatus({ code: 401 }, 'unauthorized'))).toBe('auth')
      })
    })

    describe('malformed response field does not throw', () => {
      it('handles string response field gracefully', () => {
        const e = new Error('error') as Error & { response: unknown }
        e.response = 'not-an-object'
        expect(VALID_KINDS).toContain(classifyIntegrationError(e))
      })

      it('handles numeric response field gracefully', () => {
        const e = new Error('error') as Error & { response: unknown }
        e.response = 401
        expect(VALID_KINDS).toContain(classifyIntegrationError(e))
      })

      it('handles null response field gracefully', () => {
        const e = new Error('error') as Error & { response: unknown }
        e.response = null
        expect(VALID_KINDS).toContain(classifyIntegrationError(e))
      })
    })
  })

  describe('status code to kind mapping', () => {
    describe('auth status codes', () => {
      it('maps 401 to auth', () => {
        expect(classifyIntegrationError(errorWithDirectStatus(401))).toBe('auth')
      })

      it('maps 403 to auth', () => {
        expect(classifyIntegrationError(errorWithDirectStatus(403))).toBe('auth')
      })
    })

    describe('rate limit status codes', () => {
      it('maps 429 to rate_limit', () => {
        expect(classifyIntegrationError(errorWithDirectStatus(429))).toBe('rate_limit')
      })
    })

    describe('not found status codes', () => {
      it('maps 404 to not_found', () => {
        expect(classifyIntegrationError(errorWithDirectStatus(404))).toBe('not_found')
      })
    })

    describe('server error status codes', () => {
      it('maps 500 to server_error', () => {
        expect(classifyIntegrationError(errorWithDirectStatus(500))).toBe('server_error')
      })

      it('maps 503 to server_error', () => {
        expect(classifyIntegrationError(errorWithDirectStatus(503))).toBe('server_error')
      })
    })

    describe('unclassified status codes fall through to message classification', () => {
      it('falls through for 400 (bad request)', () => {
        expect(classifyIntegrationError(errorWithDirectStatus(400, 'unauthorized'))).toBe('auth')
      })

      it('falls through for 402 (payment required)', () => {
        expect(classifyIntegrationError(errorWithDirectStatus(402, 'quota exceeded'))).toBe('rate_limit')
      })

      it('falls through for 422 (unprocessable entity)', () => {
        expect(classifyIntegrationError(errorWithDirectStatus(422, 'unknown error'))).toBe('unknown')
      })

      it('falls through for 502 (bad gateway)', () => {
        expect(classifyIntegrationError(errorWithDirectStatus(502, 'unknown error'))).toBe('unknown')
      })
    })
  })

  describe('message pattern classification', () => {
    describe('auth patterns', () => {
      it('matches "401" digit sequence in message', () => {
        expect(classifyIntegrationError(new Error('Validation failed: 401'))).toBe('auth')
      })

      it('matches "403" digit sequence in message', () => {
        expect(classifyIntegrationError(new Error('Validation failed: 403'))).toBe('auth')
      })

      it('matches "unauthorized" case-insensitively', () => {
        expect(classifyIntegrationError(new Error('Unauthorized'))).toBe('auth')
        expect(classifyIntegrationError(new Error('UNAUTHORIZED'))).toBe('auth')
      })

      it('matches "authentication failed" phrase', () => {
        expect(classifyIntegrationError(new Error('Authentication failed'))).toBe('auth')
      })

      it('matches "invalid api key" phrase', () => {
        expect(classifyIntegrationError(new Error('invalid api key provided'))).toBe('auth')
        expect(classifyIntegrationError(new Error('Invalid API Key'))).toBe('auth')
      })

      it('matches "incorrect api key" phrase', () => {
        expect(classifyIntegrationError(new Error('Incorrect API key'))).toBe('auth')
      })

      it('matches "permission denied" phrase', () => {
        expect(classifyIntegrationError(new Error('permission denied'))).toBe('auth')
      })

      it('matches "access denied" phrase', () => {
        expect(classifyIntegrationError(new Error('access denied'))).toBe('auth')
      })
    })

    describe('rate limit patterns', () => {
      it('matches "429" digit sequence in message', () => {
        expect(classifyIntegrationError(new Error('HTTP 429'))).toBe('rate_limit')
      })

      it('matches "rate limit" phrase', () => {
        expect(classifyIntegrationError(new Error('rate limit exceeded'))).toBe('rate_limit')
        expect(classifyIntegrationError(new Error('Rate Limit Exceeded'))).toBe('rate_limit')
      })

      it('matches "too many requests" phrase', () => {
        expect(classifyIntegrationError(new Error('too many requests'))).toBe('rate_limit')
      })

      it('matches "quota exceeded" phrase', () => {
        expect(classifyIntegrationError(new Error('quota exceeded'))).toBe('rate_limit')
      })

      it('matches "insufficient quota" phrase', () => {
        expect(classifyIntegrationError(new Error('insufficient quota'))).toBe('rate_limit')
      })
    })

    describe('not found patterns', () => {
      it('matches "404" digit sequence in message', () => {
        expect(classifyIntegrationError(new Error('404'))).toBe('not_found')
      })

      it('matches "not found" phrase', () => {
        expect(classifyIntegrationError(new Error('model not found'))).toBe('not_found')
        expect(classifyIntegrationError(new Error('Not Found'))).toBe('not_found')
      })
    })

    describe('server error patterns', () => {
      it('matches "500" digit sequence in message', () => {
        expect(classifyIntegrationError(new Error('HTTP 500'))).toBe('server_error')
      })

      it('matches "503" digit sequence in message', () => {
        expect(classifyIntegrationError(new Error('HTTP 503'))).toBe('server_error')
      })

      it('matches "server error" phrase', () => {
        expect(classifyIntegrationError(new Error('Internal server error'))).toBe('server_error')
        expect(classifyIntegrationError(new Error('Server Error'))).toBe('server_error')
      })

      it('matches "service unavailable" phrase', () => {
        expect(classifyIntegrationError(new Error('service unavailable'))).toBe('server_error')
      })
    })

    describe('unrecognized messages', () => {
      it('returns unknown for a message that matches no pattern', () => {
        expect(classifyIntegrationError(new Error('Something unexpected happened'))).toBe('unknown')
      })

      it('returns unknown for empty message', () => {
        expect(classifyIntegrationError(new Error(''))).toBe('unknown')
      })

      it('returns unknown for a numeric-looking message that is not a classified code', () => {
        expect(classifyIntegrationError(new Error('Error 302'))).toBe('unknown')
        expect(classifyIntegrationError(new Error('Error 418'))).toBe('unknown')
      })
    })

    describe('primitive inputs coerced to message string', () => {
      it('classifies a string input matching an auth pattern as auth', () => {
        expect(classifyIntegrationError('unauthorized')).toBe('auth')
      })

      it('classifies a string input matching no pattern as unknown', () => {
        expect(classifyIntegrationError('network error')).toBe('unknown')
      })
    })
  })

  describe('classification precedence', () => {
    it('status code classification wins over a contradicting message pattern', () => {
      expect(classifyIntegrationError(errorWithDirectStatus(429, 'invalid api key'))).toBe('rate_limit')
      expect(classifyIntegrationError(errorWithDirectStatus(401, 'quota exceeded'))).toBe('auth')
    })

    it('message classification is used when numeric status is present but unclassified', () => {
      expect(classifyIntegrationError(errorWithDirectStatus(422, 'unauthorized'))).toBe('auth')
      expect(classifyIntegrationError(errorWithDirectStatus(502, 'rate limit exceeded'))).toBe('rate_limit')
    })

    it('message classification is used when no numeric status field exists', () => {
      expect(classifyIntegrationError(new Error('unauthorized'))).toBe('auth')
      expect(classifyIntegrationError(new Error('quota exceeded'))).toBe('rate_limit')
    })
  })

  describe('null and degenerate inputs', () => {
    it('returns unknown for null', () => {
      expect(classifyIntegrationError(null)).toBe('unknown')
    })

    it('returns unknown for undefined', () => {
      expect(classifyIntegrationError(undefined)).toBe('unknown')
    })

    it('returns unknown for a number input', () => {
      expect(classifyIntegrationError(42)).toBe('unknown')
    })

    it('returns unknown for a boolean input', () => {
      expect(classifyIntegrationError(false)).toBe('unknown')
    })

    it('returns unknown for an empty plain object', () => {
      expect(classifyIntegrationError({})).toBe('unknown')
    })

    it('returns unknown for an array input', () => {
      expect(classifyIntegrationError([])).toBe('unknown')
    })

    it('does not throw for any degenerate input', () => {
      const degenerate = [null, undefined, 0, false, '', [], {}, Symbol()]
      degenerate.forEach(input => {
        expect(() => classifyIntegrationError(input)).not.toThrow()
      })
    })
  })

  describe('immutability', () => {
    it('does not mutate the error object passed in', () => {
      const error = errorWithDirectStatus(401, 'unauthorized')
      const originalStatus = error.status
      const originalMessage = error.message

      classifyIntegrationError(error)

      expect(error.status).toBe(originalStatus)
      expect(error.message).toBe(originalMessage)
    })

    it('does not mutate the nested response object', () => {
      const error = errorWithResponseStatus(403)
      const originalStatus = error.response.status

      classifyIntegrationError(error)

      expect(error.response.status).toBe(originalStatus)
    })
  })
})

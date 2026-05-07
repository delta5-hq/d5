import {JudgeErrorClassifier, JudgeNonTransientError} from './JudgeErrorClassifier'

describe('JudgeErrorClassifier.classify', () => {
  describe('quota errors', () => {
    it.each([
      ['status 429 in message', new Error('Request failed with status 429')],
      ['quota exceeded', new Error('quota_exceeded: you have exceeded your monthly quota')],
      ['rate limit', new Error('Rate limit reached for gpt-4')],
      ['rate_limit underscore', new Error('rate_limit_exceeded error')],
      ['too many requests', new Error('Too Many Requests from this IP')],
      ['insufficient quota', new Error('You have insufficient_quota for this request')],
      ['request limit', new Error('Request limit exceeded for this model')],
    ])('classifies as quota: %s', (_, error) => {
      expect(JudgeErrorClassifier.classify(error)).toBe('quota')
    })
  })

  describe('auth errors', () => {
    it.each([
      ['status 401 in message', new Error('Request failed with status 401')],
      ['status 403 in message', new Error('Request failed with status 403')],
      ['unauthorized', new Error('Unauthorized access')],
      ['authentication failed', new Error('Authentication failed for user')],
      ['invalid api key', new Error('Invalid API key provided')],
      ['incorrect api key', new Error('Incorrect API key. Please check your key.')],
      ['invalid_api_key snake', new Error('Error code: invalid_api_key')],
      ['permission denied', new Error('Permission denied for this resource')],
      ['access denied', new Error('Access denied to the requested endpoint')],
    ])('classifies as auth: %s', (_, error) => {
      expect(JudgeErrorClassifier.classify(error)).toBe('auth')
    })
  })

  describe('transient errors', () => {
    it.each([
      ['network timeout', new Error('ETIMEDOUT: connection timed out')],
      ['socket hangup', new Error('socket hang up')],
      ['ECONNRESET', new Error('read ECONNRESET')],
      ['500 internal server error', new Error('Request failed with status 500')],
      ['502 bad gateway', new Error('Request failed with status 502')],
      ['generic API error', new Error('Something went wrong')],
      ['null error', null],
      ['undefined error', undefined],
      ['empty string error', new Error('')],
    ])('classifies as transient: %s', (_, error) => {
      expect(JudgeErrorClassifier.classify(error)).toBe('transient')
    })
  })

  it('checks quota before auth so quota errors with HTTP codes are unambiguous', () => {
    const ambiguousError = new Error('429 Unauthorized rate limit exceeded')
    expect(JudgeErrorClassifier.classify(ambiguousError)).toBe('quota')
  })

  describe('non-Error inputs — classify uses message field with fallback to the value itself', () => {
    it.each([
      ['plain string with quota pattern', 'Rate limit reached', 'quota'],
      ['plain string with auth pattern', '401 Unauthorized', 'auth'],
      ['plain string with no pattern', 'Something went wrong', 'transient'],
    ])('classifies %s as %s', (_label, input, expected) => {
      expect(JudgeErrorClassifier.classify(input)).toBe(expected)
    })

    it('classifies a plain number as transient — String(number) contains no known patterns', () => {
      expect(JudgeErrorClassifier.classify(500)).toBe('transient')
    })

    it('classifies a plain object as transient — String(object) is "[object Object]"', () => {
      expect(JudgeErrorClassifier.classify({code: 401})).toBe('transient')
    })
  })
})
describe('JudgeErrorClassifier.wrapIfNonTransient', () => {
  it('returns null for transient errors', () => {
    expect(JudgeErrorClassifier.wrapIfNonTransient(new Error('ETIMEDOUT'))).toBeNull()
  })

  it('returns JudgeNonTransientError with judge_auth_error for auth failures', () => {
    const original = new Error('Request failed with status 401')
    const wrapped = JudgeErrorClassifier.wrapIfNonTransient(original)
    expect(wrapped).toBeInstanceOf(JudgeNonTransientError)
    expect(wrapped.reason).toBe('judge_auth_error')
    expect(wrapped.cause).toBe(original)
    expect(wrapped.message).toBe(original.message)
  })

  it('returns JudgeNonTransientError with judge_quota_error for quota failures', () => {
    const original = new Error('Rate limit reached for requests per minute')
    const wrapped = JudgeErrorClassifier.wrapIfNonTransient(original)
    expect(wrapped).toBeInstanceOf(JudgeNonTransientError)
    expect(wrapped.reason).toBe('judge_quota_error')
    expect(wrapped.cause).toBe(original)
  })

  it('preserves the original error message in the wrapper', () => {
    const original = new Error('invalid_api_key: key is invalid')
    const wrapped = JudgeErrorClassifier.wrapIfNonTransient(original)
    expect(wrapped.message).toBe(original.message)
  })
})

describe('JudgeNonTransientError', () => {
  it('has name JudgeNonTransientError', () => {
    const err = new JudgeNonTransientError('judge_auth_error', new Error('auth failed'))
    expect(err.name).toBe('JudgeNonTransientError')
  })

  it('is an instance of Error', () => {
    const err = new JudgeNonTransientError('judge_auth_error', new Error('auth failed'))
    expect(err).toBeInstanceOf(Error)
  })
})

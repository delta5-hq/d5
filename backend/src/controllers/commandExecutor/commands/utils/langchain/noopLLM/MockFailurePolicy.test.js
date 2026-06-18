import {assertGeneratorAllowed, MockGeneratorFailureError, MOCK_PASS_RATE_ENV} from './MockFailurePolicy'

afterEach(() => {
  delete process.env[MOCK_PASS_RATE_ENV]
})

describe('MockFailurePolicy', () => {
  describe('pass-all boundary (MOCK_PASS_RATE absent or =1)', () => {
    it('does not throw when env var is absent', () => {
      expect(() => assertGeneratorAllowed()).not.toThrow()
    })

    it('does not throw when MOCK_PASS_RATE=1', () => {
      process.env[MOCK_PASS_RATE_ENV] = '1'
      expect(() => assertGeneratorAllowed()).not.toThrow()
    })
  })

  describe('fail-all boundary (MOCK_PASS_RATE=0)', () => {
    it('throws MockGeneratorFailureError', () => {
      process.env[MOCK_PASS_RATE_ENV] = '0'
      expect(() => assertGeneratorAllowed()).toThrow(MockGeneratorFailureError)
    })

    it('error is an Error subtype whose name matches the class and message names the env variable', () => {
      process.env[MOCK_PASS_RATE_ENV] = '0'
      expect.assertions(3)
      try {
        assertGeneratorAllowed()
      } catch (e) {
        expect(e).toBeInstanceOf(Error)
        expect(e.name).toBe('MockGeneratorFailureError')
        expect(e.message).toContain(MOCK_PASS_RATE_ENV)
      }
    })

    it('throws on every invocation — failure is deterministic, not probabilistic', () => {
      process.env[MOCK_PASS_RATE_ENV] = '0'
      for (let i = 0; i < 50; i++) expect(() => assertGeneratorAllowed()).toThrow(MockGeneratorFailureError)
    })
  })

  describe('intermediate pass rate (0 < MOCK_PASS_RATE < 1)', () => {
    it('produces both passing and failing outcomes across many calls', () => {
      process.env[MOCK_PASS_RATE_ENV] = '0.5'
      let passes = 0
      let failures = 0
      for (let i = 0; i < 100; i++) {
        try {
          assertGeneratorAllowed()
          passes++
        } catch {
          failures++
        }
      }
      expect(passes).toBeGreaterThan(0)
      expect(failures).toBeGreaterThan(0)
    })
  })

  describe('invalid and out-of-range values fall back to pass-all', () => {
    it.each([
      ['non-numeric string', 'invalid'],
      ['literal NaN string', 'NaN'],
      ['empty string', ''],
      ['boolean string', 'true'],
      ['above range', '2'],
      ['below range', '-0.5'],
    ])('%s: MOCK_PASS_RATE=%s does not throw', (_label, value) => {
      process.env[MOCK_PASS_RATE_ENV] = value
      expect(() => assertGeneratorAllowed()).not.toThrow()
    })
  })
})

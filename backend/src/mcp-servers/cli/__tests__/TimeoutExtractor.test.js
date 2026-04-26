import {TimeoutExtractor} from '../TimeoutExtractor'

describe('TimeoutExtractor', () => {
  let extractor

  beforeEach(() => {
    extractor = new TimeoutExtractor()
  })

  describe('absence of timeout flag', () => {
    it('returns null timeoutMs when no timeout in args', () => {
      const result = extractor.extract(['--query=test', '--web=m'])

      expect(result.hasTimeout).toBe(false)
      expect(result.timeoutMs).toBeNull()
      expect(result.error).toBeNull()
    })

    it('preserves all args when no timeout present', () => {
      const args = ['--query=AI', '--citations', '--maxYear=2024']
      const result = extractor.extract(args)

      expect(result.remainingArgs).toEqual(args)
    })

    it('handles empty args array', () => {
      const result = extractor.extract([])

      expect(result.hasTimeout).toBe(false)
      expect(result.remainingArgs).toEqual([])
    })
  })

  describe('timeout extraction', () => {
    it('extracts timeout value and removes flag from args', () => {
      const result = extractor.extract(['--a=1', '--timeout=30000', '--b=2'])

      expect(result.timeoutMs).toBe(30000)
      expect(result.remainingArgs).toEqual(['--a=1', '--b=2'])
      expect(result.error).toBeNull()
    })

    it('handles timeout as only argument', () => {
      const result = extractor.extract(['--timeout=10000'])

      expect(result.timeoutMs).toBe(10000)
      expect(result.remainingArgs).toEqual([])
    })

    it('uses last timeout when multiple provided', () => {
      const result = extractor.extract(['--timeout=10000', '--timeout=20000', '--timeout=30000'])

      expect(result.timeoutMs).toBe(30000)
    })

    it('removes all timeout occurrences from remaining args', () => {
      const result = extractor.extract(['--a=1', '--timeout=5000', '--b=2', '--timeout=8000'])

      expect(result.remainingArgs).toEqual(['--a=1', '--b=2'])
    })
  })

  describe('quote stripping', () => {
    it('strips matching double quotes', () => {
      const result = extractor.extract(['--timeout="60000"'])

      expect(result.timeoutMs).toBe(60000)
    })

    it('strips matching single quotes', () => {
      const result = extractor.extract(["--timeout='45000'"])

      expect(result.timeoutMs).toBe(45000)
    })

    it('preserves mismatched quotes as part of value', () => {
      const result = extractor.extract(['--timeout="10000'])

      expect(result.error).toContain('"10000')
    })

    it('treats empty quoted string as empty value', () => {
      const result = extractor.extract(['--timeout=""'])

      expect(result.error).toContain('cannot be empty')
    })
  })

  describe('validation rules', () => {
    it('rejects bare flag without value', () => {
      const result = extractor.extract(['--timeout'])

      expect(result.hasTimeout).toBe(true)
      expect(result.timeoutMs).toBeNull()
      expect(result.error).toContain('requires a value')
    })

    it('rejects empty value', () => {
      const result = extractor.extract(['--timeout='])

      expect(result.error).toContain('cannot be empty')
    })

    it('rejects negative integers', () => {
      const result = extractor.extract(['--timeout=-1000'])

      expect(result.error).toContain('positive integer')
      expect(result.error).toContain('-1000')
    })

    it('rejects zero', () => {
      const result = extractor.extract(['--timeout=0'])

      expect(result.error).toContain('positive integer')
    })

    it('rejects decimals', () => {
      const result = extractor.extract(['--timeout=3.5'])

      expect(result.error).toContain('positive integer')
      expect(result.error).toContain('3.5')
    })

    it('rejects non-numeric strings', () => {
      const result = extractor.extract(['--timeout=abc'])

      expect(result.error).toContain('positive integer')
      expect(result.error).toContain('abc')
    })

    it('rejects numeric strings with units', () => {
      const result = extractor.extract(['--timeout=30s'])

      expect(result.error).toContain('positive integer')
    })

    it('preserves args when validation fails', () => {
      const args = ['--timeout=invalid', '--query=test']
      const result = extractor.extract(args)

      expect(result.remainingArgs).toEqual(args)
    })
  })

  describe('boundary values', () => {
    it('accepts minimum positive integer', () => {
      const result = extractor.extract(['--timeout=1'])

      expect(result.timeoutMs).toBe(1)
    })

    it('accepts MAX_SAFE_INTEGER', () => {
      const maxSafe = Number.MAX_SAFE_INTEGER.toString()
      const result = extractor.extract([`--timeout=${maxSafe}`])

      expect(result.timeoutMs).toBe(Number.MAX_SAFE_INTEGER)
    })

    it('rejects values exceeding MAX_SAFE_INTEGER', () => {
      const tooBig = (Number.MAX_SAFE_INTEGER + 1).toString()
      const result = extractor.extract([`--timeout=${tooBig}`])

      expect(result.error).toContain('positive integer')
    })
  })

  describe('flag isolation', () => {
    it('distinguishes --timeout from similar flag names', () => {
      const result = extractor.extract(['--timeoutMs=10000', '--timeout=5000', '--timeout-retry=3'])

      expect(result.timeoutMs).toBe(5000)
      expect(result.remainingArgs).toEqual(['--timeoutMs=10000', '--timeout-retry=3'])
    })

    it('preserves order of non-timeout args', () => {
      const result = extractor.extract(['--a=1', '--timeout=5000', '--b=2', '--c=3'])

      expect(result.remainingArgs).toEqual(['--a=1', '--b=2', '--c=3'])
    })

    it('handles complex JSON args alongside timeout', () => {
      const result = extractor.extract(['--urls=["http://a.com"]', '--timeout=15000', '--maxSize=10mb'])

      expect(result.timeoutMs).toBe(15000)
      expect(result.remainingArgs).toEqual(['--urls=["http://a.com"]', '--maxSize=10mb'])
    })
  })

  describe('error messages', () => {
    it('provides usage example for bare flag', () => {
      const result = extractor.extract(['--timeout'])

      expect(result.error).toContain('--timeout=30000')
    })

    it('includes invalid value in error message', () => {
      const result = extractor.extract(['--timeout=invalid'])

      expect(result.error).toContain('invalid')
    })
  })
})

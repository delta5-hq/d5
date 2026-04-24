import {readReliabilityN, RELIABILITY_DEFAULT_N, RELIABILITY_MAX_N} from './reliability'

describe('reliability constants', () => {
  describe('readReliabilityN', () => {
    describe('valid N values', () => {
      it('should extract N from :n=3 syntax', () => {
        expect(readReliabilityN('/chatgpt :n=3 write a poem')).toBe(3)
      })

      it('should extract N from command with multiple params', () => {
        expect(readReliabilityN('/chatgpt :n=2 --table query data')).toBe(2)
      })

      it('should handle N at end of string', () => {
        expect(readReliabilityN('/claude analyze data :n=5')).toBe(5)
      })

      it('should handle N with no spaces', () => {
        expect(readReliabilityN('/chatgpt:n=4')).toBe(4)
      })

      it('should handle single-digit N', () => {
        expect(readReliabilityN(':n=1')).toBe(1)
      })

      it('should handle double-digit N', () => {
        expect(readReliabilityN(':n=10')).toBe(10)
      })
    })

    describe('boundary conditions', () => {
      it('should clamp N to maximum of 10', () => {
        expect(readReliabilityN(':n=100')).toBe(RELIABILITY_MAX_N)
      })

      it('should clamp N to maximum for very large values', () => {
        expect(readReliabilityN(':n=99999')).toBe(RELIABILITY_MAX_N)
      })

      it('should treat zero as default', () => {
        expect(readReliabilityN(':n=0')).toBe(RELIABILITY_DEFAULT_N)
      })

      it('should treat negative values as default', () => {
        expect(readReliabilityN(':n=-5')).toBe(RELIABILITY_DEFAULT_N)
      })
    })

    describe('missing or invalid input', () => {
      it('should return default when no :n param present', () => {
        expect(readReliabilityN('/chatgpt write a poem')).toBe(RELIABILITY_DEFAULT_N)
      })

      it('should return default for empty string', () => {
        expect(readReliabilityN('')).toBe(RELIABILITY_DEFAULT_N)
      })

      it('should return default for null', () => {
        expect(readReliabilityN(null)).toBe(RELIABILITY_DEFAULT_N)
      })

      it('should return default for undefined', () => {
        expect(readReliabilityN(undefined)).toBe(RELIABILITY_DEFAULT_N)
      })

      it('should return default for malformed :n= with no number', () => {
        expect(readReliabilityN(':n=')).toBe(RELIABILITY_DEFAULT_N)
      })

      it('should return default for :n= with non-numeric value', () => {
        expect(readReliabilityN(':n=abc')).toBe(RELIABILITY_DEFAULT_N)
      })

      it('should return default for :n= with float', () => {
        expect(readReliabilityN(':n=3.5')).toBe(3)
      })
    })

    describe('edge cases with similar patterns', () => {
      it('should not match n= without colon prefix', () => {
        expect(readReliabilityN('n=5 query')).toBe(RELIABILITY_DEFAULT_N)
      })

      it('should not match :N= with capital N', () => {
        expect(readReliabilityN(':N=5 query')).toBe(RELIABILITY_DEFAULT_N)
      })

      it('should handle multiple :n= occurrences (use first)', () => {
        expect(readReliabilityN(':n=3 some text :n=5')).toBe(3)
      })

      it('should handle command with only :n= param', () => {
        expect(readReliabilityN(':n=2')).toBe(2)
      })
    })

    describe('whitespace handling', () => {
      it('should handle leading whitespace', () => {
        expect(readReliabilityN('   :n=4 query')).toBe(4)
      })

      it('should handle trailing whitespace', () => {
        expect(readReliabilityN(':n=4   ')).toBe(4)
      })

      it('should handle whitespace around :n=', () => {
        expect(readReliabilityN('query :n=3 more')).toBe(3)
      })
    })
  })
})

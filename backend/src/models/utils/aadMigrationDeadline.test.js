import {parseAadMigrationDeadline, isDeadlineExceeded} from './aadMigrationDeadline'

describe('aadMigrationDeadline', () => {
  describe('parseAadMigrationDeadline', () => {
    describe('absent or empty input returns null', () => {
      it('returns null for undefined', () => {
        expect(parseAadMigrationDeadline(undefined)).toBeNull()
      })

      it('returns null for null', () => {
        expect(parseAadMigrationDeadline(null)).toBeNull()
      })

      it('returns null for empty string', () => {
        expect(parseAadMigrationDeadline('')).toBeNull()
      })
    })

    describe('valid ISO-8601 input returns numeric timestamp', () => {
      it('returns a number for a full ISO-8601 datetime string', () => {
        const input = '2026-01-01T00:00:00.000Z'

        const result = parseAadMigrationDeadline(input)

        expect(typeof result).toBe('number')
        expect(result).toBe(Date.parse(input))
      })

      it('returns a number for a date-only string', () => {
        const input = '2026-06-01'

        const result = parseAadMigrationDeadline(input)

        expect(typeof result).toBe('number')
        expect(Number.isNaN(result)).toBe(false)
      })

      it('returned timestamp preserves the exact point in time', () => {
        const input = '2025-03-15T12:00:00.000Z'

        expect(parseAadMigrationDeadline(input)).toBe(new Date(input).getTime())
      })
    })

    describe('invalid input throws with an actionable message', () => {
      it('throws for a non-date string', () => {
        expect(() => parseAadMigrationDeadline('not-a-date')).toThrow(/Invalid AAD_MIGRATION_DEADLINE/)
      })

      it('error message includes the offending value', () => {
        expect(() => parseAadMigrationDeadline('not-a-date')).toThrow(/not-a-date/)
      })

      it('error message states expected format', () => {
        expect(() => parseAadMigrationDeadline('not-a-date')).toThrow(/ISO-8601/)
      })
    })
  })

  describe('isDeadlineExceeded', () => {
    it('returns false when no deadline is set (null)', () => {
      expect(isDeadlineExceeded(null)).toBe(false)
    })

    it('returns false for a future timestamp', () => {
      expect(isDeadlineExceeded(Date.now() + 60000)).toBe(false)
    })

    it('returns false when timestamp equals current time — boundary is strict greater-than', () => {
      const now = Date.now()
      expect(isDeadlineExceeded(now)).toBe(false)
    })

    it('returns true for a past timestamp', () => {
      expect(isDeadlineExceeded(Date.now() - 60000)).toBe(true)
    })

    it('returns true for epoch zero — always in the past', () => {
      expect(isDeadlineExceeded(0)).toBe(true)
    })
  })
})

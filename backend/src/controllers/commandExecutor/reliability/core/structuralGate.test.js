import {passesStructuralGate, passesCommodityGate, MIN_SUBSTANTIVE_CHARS} from './structuralGate'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

const EMPTY_INPUTS = [null, undefined, '', '   ', '\n\t']

const REFUSAL_FIXTURES = [
  "I'm sorry, I cannot help with that.",
  'I am sorry, I cannot assist with this.',
  'I cannot help with this request.',
  'I cannot assist with generating that content.',
  'I cannot provide information about that.',
  'I cannot create content of that nature.',
  'I cannot write that kind of content.',
  "I am afraid I can't do that.",
  "I'm afraid I cannot comply.",
  'As an AI, I cannot generate harmful content.',
  'As a language model, I cannot assist with that.',
  'Sorry, as an AI language model I cannot help.',
  "I'd prefer not to do that.",
  "Unfortunately, I can't help with this.",
  'Unfortunately, I cannot complete this request.',
  "Unfortunately, I don't have the ability to do that.",
]

const SUBSTANTIVE_FIXTURES = [
  'The top 5 competitors are Acme Corp, Beta Inc, Gamma Ltd, Delta Co, and Epsilon LLC.',
  'Market analysis: The sector grew 12% year-over-year driven by increased digital adoption.',
  'Here are three recommendations for improving your workflow efficiency.',
  'I think the best approach would be to start with the core infrastructure.',
  'Based on the data provided, revenue projections indicate strong growth potential.',
]

describe('passesStructuralGate', () => {
  describe('empty output → fails', () => {
    it.each(EMPTY_INPUTS)('rejects %p', input => {
      expect(passesStructuralGate(input)).toBe(false)
    })
  })

  describe('refusal patterns → fails', () => {
    it.each(REFUSAL_FIXTURES)('rejects refusal: "%s"', text => {
      expect(passesStructuralGate(text)).toBe(false)
    })
  })

  describe('output below truncation floor → fails', () => {
    it.each(['Yes.', 'No.', 'Done.', 'OK', 'Sure.', '1. Item'])('rejects "%s"', text => {
      expect(passesStructuralGate(text)).toBe(false)
    })

    it('fails text of exactly MIN_SUBSTANTIVE_CHARS - 1', () => {
      expect(passesStructuralGate('a'.repeat(MIN_SUBSTANTIVE_CHARS - 1))).toBe(false)
    })
  })

  describe('output at or above truncation floor → passes', () => {
    it('passes text of exactly MIN_SUBSTANTIVE_CHARS', () => {
      expect(passesStructuralGate('a'.repeat(MIN_SUBSTANTIVE_CHARS))).toBe(true)
    })

    it.each(SUBSTANTIVE_FIXTURES)('passes "%s"', text => {
      expect(passesStructuralGate(text)).toBe(true)
    })
  })

  describe('refusal detection is position-sensitive', () => {
    it('passes text starting with "I" whose verb is not in the refusal pattern', () => {
      expect(
        passesStructuralGate('I cannot determine the exact cause without more data — here are three hypotheses.'),
      ).toBe(true)
    })

    it('passes "I cannot" when it does not appear at the start of the text', () => {
      expect(passesStructuralGate('The main reason I cannot confirm this is the limited dataset available.')).toBe(true)
    })

    it('passes text starting with "I" that matches no refusal pattern at all', () => {
      expect(passesStructuralGate('Implementing this feature requires three steps: first...')).toBe(true)
    })

    it('rejects leading-whitespace refusal — trimStart() applied before pattern match', () => {
      expect(passesStructuralGate("\nI'm sorry, I cannot help with that.")).toBe(false)
      expect(passesStructuralGate('   As an AI, I cannot generate harmful content.')).toBe(false)
    })
  })

  describe('forkIndex parameter — observability-only, does not alter verdict', () => {
    const substantive = 'a'.repeat(MIN_SUBSTANTIVE_CHARS)

    it.each([0, 1, 99, null, undefined])('substantive text passes regardless of forkIndex=%s', forkIndex => {
      expect(passesStructuralGate(substantive, forkIndex)).toBe(true)
    })

    it.each([0, 99, null])('empty string fails regardless of forkIndex=%s', forkIndex => {
      expect(passesStructuralGate('', forkIndex)).toBe(false)
    })
  })

  describe('structured debug log on every rejection', () => {
    let log

    beforeEach(() => {
      log = jest.requireMock('debug')
      log.mockClear()
    })

    const rejectionCalls = () => log.mock.calls.filter(([fmt]) => fmt === '%s rejected: %s')

    it('logs empty output rejection with fork-? label when forkIndex omitted', () => {
      passesStructuralGate('')
      const calls = rejectionCalls()
      expect(calls).toHaveLength(1)
      expect(calls[0]).toEqual(['%s rejected: %s', 'fork-?', 'empty output'])
    })

    it('logs refusal-pattern rejection with reason including matched prefix', () => {
      passesStructuralGate("I'm sorry, I cannot help with that.")
      const calls = rejectionCalls()
      expect(calls).toHaveLength(1)
      expect(calls[0][1]).toBe('fork-?')
      expect(calls[0][2]).toMatch(/refusal pattern matched/)
    })

    it('logs truncated-output rejection with char count in reason', () => {
      const input = 'Too short.'
      passesStructuralGate(input)
      const calls = rejectionCalls()
      expect(calls).toHaveLength(1)
      expect(calls[0][2]).toContain(String(input.trim().length))
      expect(calls[0][2]).toMatch(/output too short/)
    })

    it.each([0, 3, 99])('uses fork-%i label when forkIndex is %i', forkIndex => {
      passesStructuralGate('', forkIndex)
      const calls = rejectionCalls()
      expect(calls[0][1]).toBe(`fork-${forkIndex}`)
    })

    it.each([null, undefined])('uses fork-? label when forkIndex is %s', forkIndex => {
      passesStructuralGate('', forkIndex)
      const calls = rejectionCalls()
      expect(calls[0][1]).toBe('fork-?')
    })

    it('produces exactly one log entry per rejected call', () => {
      passesStructuralGate('')
      passesStructuralGate('')
      expect(rejectionCalls()).toHaveLength(2)
    })

    it('produces no rejection log entry when output passes the gate', () => {
      passesStructuralGate('a'.repeat(MIN_SUBSTANTIVE_CHARS))
      expect(rejectionCalls()).toHaveLength(0)
    })
  })
})

describe('passesCommodityGate', () => {
  describe('empty output → fails', () => {
    it.each(EMPTY_INPUTS)('rejects %p', input => {
      expect(passesCommodityGate(input)).toBe(false)
    })
  })

  describe('refusal patterns → fails', () => {
    it.each(REFUSAL_FIXTURES)('rejects refusal: "%s"', text => {
      expect(passesCommodityGate(text)).toBe(false)
    })
  })

  describe('truncation floor is absent — any non-empty, non-refusal output passes', () => {
    it.each(['a', '1', 'x'])('passes single-character output "%s"', text => {
      expect(passesCommodityGate(text)).toBe(true)
    })

    it('passes text of exactly MIN_SUBSTANTIVE_CHARS - 1', () => {
      expect(passesCommodityGate('a'.repeat(MIN_SUBSTANTIVE_CHARS - 1))).toBe(true)
    })

    it('passes text of exactly MIN_SUBSTANTIVE_CHARS', () => {
      expect(passesCommodityGate('a'.repeat(MIN_SUBSTANTIVE_CHARS))).toBe(true)
    })

    it.each(['hello', 'yes', 'no', '42', 'No.', 'Done.', 'Ok', 'True'])('passes short reply "%s"', text => {
      expect(passesCommodityGate(text)).toBe(true)
    })
  })

  describe('output at or above truncation floor → also passes', () => {
    it.each(SUBSTANTIVE_FIXTURES)('passes "%s"', text => {
      expect(passesCommodityGate(text)).toBe(true)
    })
  })

  describe('refusal detection is position-sensitive', () => {
    it('passes text starting with "I" whose verb is not in the refusal pattern', () => {
      expect(
        passesCommodityGate('I cannot determine the exact cause without more data — here are three hypotheses.'),
      ).toBe(true)
    })

    it('passes "I cannot" when it does not appear at the start of the text', () => {
      expect(passesCommodityGate('The main reason I cannot confirm this is the limited dataset available.')).toBe(true)
    })

    it('passes text starting with "I" that matches no refusal pattern at all', () => {
      expect(passesCommodityGate('Implementing this.')).toBe(true)
    })

    it('rejects leading-whitespace refusal — trimStart() applied before pattern match', () => {
      expect(passesCommodityGate("\nI'm sorry, I cannot help with that.")).toBe(false)
      expect(passesCommodityGate('   As an AI, I cannot generate harmful content.')).toBe(false)
    })
  })

  describe('forkIndex parameter — observability-only, does not alter verdict', () => {
    it.each([0, 1, 99, null, undefined])('short reply passes regardless of forkIndex=%s', forkIndex => {
      expect(passesCommodityGate('hello', forkIndex)).toBe(true)
    })

    it.each([0, 1, 99, null, undefined])('empty string fails regardless of forkIndex=%s', forkIndex => {
      expect(passesCommodityGate('', forkIndex)).toBe(false)
    })
  })

  describe('structured debug log on every rejection', () => {
    let log

    beforeEach(() => {
      log = jest.requireMock('debug')
      log.mockClear()
    })

    const rejectionCalls = () => log.mock.calls.filter(([fmt]) => fmt === '%s rejected: %s')

    it('logs empty output rejection with fork-? label when forkIndex omitted', () => {
      passesCommodityGate('')
      const calls = rejectionCalls()
      expect(calls).toHaveLength(1)
      expect(calls[0]).toEqual(['%s rejected: %s', 'fork-?', 'empty output'])
    })

    it('logs refusal-pattern rejection with reason including matched prefix', () => {
      passesCommodityGate("I'm sorry, I cannot help with that.")
      const calls = rejectionCalls()
      expect(calls).toHaveLength(1)
      expect(calls[0][1]).toBe('fork-?')
      expect(calls[0][2]).toMatch(/refusal pattern matched/)
    })

    it.each([0, 3, 99])('uses fork-%i label when forkIndex is %i', forkIndex => {
      passesCommodityGate('', forkIndex)
      const calls = rejectionCalls()
      expect(calls[0][1]).toBe(`fork-${forkIndex}`)
    })

    it.each([null, undefined])('uses fork-? label when forkIndex is %s', forkIndex => {
      passesCommodityGate('', forkIndex)
      const calls = rejectionCalls()
      expect(calls[0][1]).toBe('fork-?')
    })

    it('produces exactly one log entry per rejected call', () => {
      passesCommodityGate('')
      passesCommodityGate('')
      expect(rejectionCalls()).toHaveLength(2)
    })

    it('produces no rejection log entry when short non-refusal output passes', () => {
      passesCommodityGate('hello')
      expect(rejectionCalls()).toHaveLength(0)
    })

    it('produces no rejection log entry when substantive output passes', () => {
      passesCommodityGate('a'.repeat(MIN_SUBSTANTIVE_CHARS))
      expect(rejectionCalls()).toHaveLength(0)
    })
  })
})

describe('cross-gate behavioral parity: shared base checks, diverge only on truncation floor', () => {
  describe('both gates reject empty and refusal inputs identically', () => {
    it.each(EMPTY_INPUTS)('both reject empty input %p', input => {
      expect(passesStructuralGate(input)).toBe(false)
      expect(passesCommodityGate(input)).toBe(false)
    })

    it.each(REFUSAL_FIXTURES)('both reject refusal: "%s"', text => {
      expect(passesStructuralGate(text)).toBe(false)
      expect(passesCommodityGate(text)).toBe(false)
    })
  })

  describe('both gates pass substantive non-refusal inputs identically', () => {
    it.each(SUBSTANTIVE_FIXTURES)('both pass "%s"', text => {
      expect(passesStructuralGate(text)).toBe(true)
      expect(passesCommodityGate(text)).toBe(true)
    })
  })

  describe('truncation floor is the sole behavioral difference between the two gates', () => {
    it('below floor: structural gate rejects, commodity gate passes', () => {
      const belowFloor = 'a'.repeat(MIN_SUBSTANTIVE_CHARS - 1)
      expect(passesStructuralGate(belowFloor)).toBe(false)
      expect(passesCommodityGate(belowFloor)).toBe(true)
    })

    it('at floor: both gates pass (floor is inclusive)', () => {
      const atFloor = 'a'.repeat(MIN_SUBSTANTIVE_CHARS)
      expect(passesStructuralGate(atFloor)).toBe(true)
      expect(passesCommodityGate(atFloor)).toBe(true)
    })

    it('above floor: both gates pass', () => {
      const aboveFloor = 'a'.repeat(MIN_SUBSTANTIVE_CHARS + 1)
      expect(passesStructuralGate(aboveFloor)).toBe(true)
      expect(passesCommodityGate(aboveFloor)).toBe(true)
    })

    it('empty/refusal verdicts are unaffected by truncation check — both gates reject before reaching it', () => {
      const shortRefusal = "I'm sorry."
      expect(shortRefusal.trim().length).toBeLessThan(MIN_SUBSTANTIVE_CHARS)
      expect(passesStructuralGate(shortRefusal)).toBe(false)
      expect(passesCommodityGate(shortRefusal)).toBe(false)
    })
  })

  describe('forkIndex observability is consistent across both gates', () => {
    let log

    beforeEach(() => {
      log = jest.requireMock('debug')
      log.mockClear()
    })

    const rejectionCalls = () => log.mock.calls.filter(([fmt]) => fmt === '%s rejected: %s')

    it('both gates use identical fork label format on rejection', () => {
      passesStructuralGate('', 3)
      const structuralCall = rejectionCalls()[0]
      log.mockClear()

      passesCommodityGate('', 3)
      const commodityCall = rejectionCalls()[0]

      expect(structuralCall[1]).toBe(commodityCall[1])
    })

    it('both gates emit exactly one rejection log per rejected call', () => {
      passesStructuralGate('')
      const structuralCount = rejectionCalls().length
      log.mockClear()

      passesCommodityGate('')
      const commodityCount = rejectionCalls().length

      expect(structuralCount).toBe(1)
      expect(commodityCount).toBe(1)
    })
  })
})

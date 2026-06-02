import {passesStructuralGate, MIN_SUBSTANTIVE_CHARS} from './structuralGate'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

describe('passesStructuralGate', () => {
  describe('empty output → fails', () => {
    it.each([null, undefined, '', '   ', '\n\t'])('rejects %p', input => {
      expect(passesStructuralGate(input)).toBe(false)
    })
  })

  describe('refusal patterns → fails', () => {
    it.each([
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
    ])('rejects refusal: "%s"', text => {
      expect(passesStructuralGate(text)).toBe(false)
    })
  })

  describe('truncated output (< 20 chars) → fails', () => {
    it.each(['Yes.', 'No.', 'Done.', 'OK', 'Sure.', '1. Item'])('rejects "%s"', text => {
      expect(passesStructuralGate(text)).toBe(false)
    })
  })

  describe('substantive output → passes', () => {
    it.each([
      'The top 5 competitors are Acme Corp, Beta Inc, Gamma Ltd, Delta Co, and Epsilon LLC.',
      'Market analysis: The sector grew 12% year-over-year driven by increased digital adoption.',
      'Here are three recommendations for improving your workflow efficiency.',
      'I think the best approach would be to start with the core infrastructure.',
      'Based on the data provided, revenue projections indicate strong growth potential.',
    ])('passes "%s"', text => {
      expect(passesStructuralGate(text)).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('passes text starting with "I" that is not a refusal', () => {
      expect(passesStructuralGate('Implementing this feature requires three steps: first...')).toBe(true)
    })

    it('passes text of exactly MIN_SUBSTANTIVE_CHARS', () => {
      expect(passesStructuralGate('a'.repeat(MIN_SUBSTANTIVE_CHARS))).toBe(true)
    })

    it('fails text of exactly MIN_SUBSTANTIVE_CHARS - 1', () => {
      expect(passesStructuralGate('a'.repeat(MIN_SUBSTANTIVE_CHARS - 1))).toBe(false)
    })

    it('passes "I cannot" when the following verb is not in the refusal pattern', () => {
      expect(
        passesStructuralGate('I cannot determine the exact cause without more data — here are three hypotheses.'),
      ).toBe(true)
    })

    it('passes "I cannot" when it does not appear at the start of the text', () => {
      expect(passesStructuralGate('The main reason I cannot confirm this is the limited dataset available.')).toBe(true)
    })

    it('rejects leading-whitespace refusal — trim() is applied before pattern matching', () => {
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

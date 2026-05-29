import {passesStructuralGate, MIN_SUBSTANTIVE_CHARS} from './structuralGate'

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
  })
})

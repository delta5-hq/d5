import {parseJurorResponse} from './jurorVerdictParser'

// The juror verdict is a gate predicate: a reply passes only when it is a recognised affirmation.
// These tests pin the algorithm's behaviour classes, not one bug's strings — the verdict is decided
// on the LEADING token, an affirmative word inside prose or a negation never leaks through, an
// unrecognised reply is a NON-AFFIRMATION carrying {unparsed:true}, and the parser never emits the
// crash sentinel {passed:null} (only the juror call site does). The P0.2 leak strings and the P0.9
// no-parse sentinel are pinned within these classes as reproduced-defect anchors.

describe('parseJurorResponse', () => {
  const passed = reply => parseJurorResponse(reply)

  describe('affirmation — a recognised YES, however it is wrapped', () => {
    it.each([
      ['bare leading yes', 'yes'],
      ['leading yes with trailing punctuation', 'yes.'],
      ['leading yes then a reason', 'YES: the reply is non-empty'],
      ['markdown-emphasised', '**YES**'],
      ['leading noise then yes', '> yes'],
      ['backtick-wrapped', '`yes`'],
      ['quote-wrapped', '"yes"'],
      ['bare yes behind a plain label', 'Answer: YES'],
      // Secondary affirmations pass only as the WHOLE reply, case-insensitively.
      ['whole-word true', 'true'],
      ['whole-word correct', 'CORRECT'],
      ['whole-word passed', 'passed'],
      ['object form carrying yes', {content: 'yes'}],
    ])('affirms: %s', (_, reply) => {
      const result = passed(reply)
      expect(result.passed).toBe(true)
      expect(result.unparsed).toBeUndefined()
    })
  })

  describe('rejection — a leading negative token is a genuine NO, never an abstention', () => {
    it.each([
      ['no', 'no'],
      ['false', 'false'],
      ['incorrect', 'incorrect'],
      ['negative', 'negative'],
      ['fail', 'fail'],
      ['failed', 'failed'],
      ['case-insensitive NO', 'NO'],
      ['negative mid-sentence continuation', 'No, the content is empty'],
      ['object form carrying a negative', {content: 'NO: bad'}],
    ])('rejects: %s', (_, reply) => {
      expect(passed(reply).passed).toBe(false)
    })

    it('carries the delimited tail as the reason', () => {
      expect(parseJurorResponse('Negative: the content is empty.')).toEqual({
        passed: false,
        reason: 'the content is empty.',
      })
      expect(parseJurorResponse('FAIL: empty output')).toEqual({passed: false, reason: 'empty output'})
    })

    it('falls back to the whole text when a bare negative token has no tail', () => {
      expect(parseJurorResponse('NO.')).toEqual({passed: false, reason: 'NO.'})
    })
  })

  describe('non-affirmation — an affirmative word that is not the leading verdict never leaks (P0.2)', () => {
    it.each([
      ['affirmative word inside a negation', 'Correct format, but the content is empty, so NO.'],
      ['affirmative verb behind a failing clause', 'Passed the format check but failed the emptiness check.'],
      ['affirmative word opening a negative label', 'True negative: the content is empty.'],
      ['yes buried behind a non-bare label', 'Criterion not satisfied: yes the reply is empty'],
    ])('does not pass: %s', (_, reply) => {
      expect(parseJurorResponse(reply).passed).toBe(false)
    })
  })

  describe('unparsed sentinel — unrecognised replies stay a non-affirmation, distinct from the crash sentinel (P0.9)', () => {
    it.each([
      ['plain prose', 'Maybe?'],
      ['hedged prose', 'I am not sure'],
      ['a lone number', '42'],
      ['plain rejection with no leading negative token', 'The content does not satisfy the criterion.'],
      ['slang rejection', 'Nope.'],
    ])('marks unparsed: %s', (_, reply) => {
      const result = parseJurorResponse(reply)
      expect(result.passed).toBe(false)
      expect(result.unparsed).toBe(true)
    })

    it.each([
      ['empty string', ''],
      ['whitespace only', '   '],
      ['null', null],
      ['undefined', undefined],
      ['object with no content', {}],
    ])('an absent or empty reply is an unparsed non-affirmation, not a pass and not a throw: %s', (_, reply) => {
      const result = parseJurorResponse(reply)
      expect(result.passed).toBe(false)
      expect(result.unparsed).toBe(true)
    })

    it('never returns the crash sentinel passed:null for any reply shape', () => {
      for (const reply of ['yes', 'no', '', 'Maybe?', {content: 'unclear'}, null, undefined]) {
        expect(parseJurorResponse(reply).passed).not.toBeNull()
      }
    })
  })
})

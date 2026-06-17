import {
  STRUCTURAL_GATE_DRIFT_SIGNAL,
  buildStructuralGateDriftEvent,
  isRefusalDriftCandidate,
  recordStructuralGateDrift,
  shouldRecordStructuralGateDrift,
} from './structuralGateDrift'

const refusalDriftCases = [
  'I will not comply with that request.',
  "I won't provide that output.",
  'I am not allowed to provide that.',
  "I'm not comfortable to continue.",
  'I am not able to answer that.',
  "I can't comply with that.",
  'Policy prevents me from answering.',
  'The safety policy requires me to refuse this.',
  'I must refuse this request.',
]

const nonDriftCases = [
  'Market share increased by 12 percent.',
  'I can provide a concise answer.',
  'I cannot help appears here but not at the beginning.',
  'Unfortunately this market fell 12 percent, but the answer is valid.',
  '',
  null,
]

describe('structuralGateDrift', () => {
  describe('refusal-drift classification', () => {
    it.each(refusalDriftCases)('classifies unrecognized refusal form: %s', text => {
      expect(isRefusalDriftCandidate(text)).toBe(true)
    })

    it.each(nonDriftCases)('does not classify ordinary content: %p', text => {
      expect(isRefusalDriftCandidate(text)).toBe(false)
    })
  })

  describe('recording predicate', () => {
    it.each([
      ['refusal-shaped loser', 'I must refuse this request.', 2, 0, true],
      ['refusal-shaped tie', 'I must refuse this request.', 0, 0, false],
      ['refusal-shaped winner', 'I must refuse this request.', 0, 2, false],
      ['ordinary loser', 'usable answer', 2, 0, false],
    ])('%s', (_, content, score, winnerScore, expected) => {
      expect(shouldRecordStructuralGateDrift({content, score, winnerScore})).toBe(expected)
    })
  })

  describe('operator event payload', () => {
    it.each([
      {forkIndex: 0, score: 1, winnerScore: 0, rankingCount: 1},
      {forkIndex: 2, score: 4, winnerScore: 1, rankingCount: 3},
    ])('preserves numeric diagnostics %#', payload => {
      expect(buildStructuralGateDriftEvent(payload)).toEqual(payload)
    })

    it.each(refusalDriftCases.slice(0, 4))('records content-free signal for drift candidate: %s', content => {
      const log = jest.fn()
      const event = recordStructuralGateDrift({
        log,
        forkIndex: 1,
        content,
        score: 3,
        winnerScore: 0,
        rankingCount: 2,
      })

      expect(event).toEqual({forkIndex: 1, score: 3, winnerScore: 0, rankingCount: 2})
      expect(log).toHaveBeenCalledWith(expect.stringContaining(STRUCTURAL_GATE_DRIFT_SIGNAL), 1, 3, 0, 2)
      expect(log.mock.calls[0].join(' ')).not.toContain(content)
    })

    it.each(nonDriftCases)('returns null and emits nothing for non-drift content: %p', content => {
      const log = jest.fn()
      const event = recordStructuralGateDrift({
        log,
        forkIndex: 1,
        content,
        score: 3,
        winnerScore: 0,
        rankingCount: 2,
      })

      expect(event).toBeNull()
      expect(log).not.toHaveBeenCalled()
    })
  })
})

import VoteAggregator from './VoteAggregator'

describe('VoteAggregator.majority', () => {
  it('returns 0 for empty votes', () => {
    expect(VoteAggregator.majority([], 3)).toBe(0)
  })

  it('returns the unanimous winner', () => {
    expect(VoteAggregator.majority([1, 1, 1], 3)).toBe(1)
  })

  it('returns the majority winner', () => {
    expect(VoteAggregator.majority([0, 1, 1], 3)).toBe(1)
  })

  it('breaks ties by lowest index (first encountered)', () => {
    expect(VoteAggregator.majority([0, 1], 3)).toBe(0)
  })

  it('handles single vote', () => {
    expect(VoteAggregator.majority([2], 3)).toBe(2)
  })

  it('handles two candidates', () => {
    expect(VoteAggregator.majority([0, 0, 1], 2)).toBe(0)
    expect(VoteAggregator.majority([1, 1, 0], 2)).toBe(1)
  })

  it('ignores out-of-range votes', () => {
    expect(VoteAggregator.majority([0, 99, 0], 3)).toBe(0)
  })

  it('returns 0 when all votes are tied across all candidates', () => {
    expect(VoteAggregator.majority([0, 1, 2], 3)).toBe(0)
  })

  it('returns 0 when all votes are out of range — no valid candidate receives votes', () => {
    expect(VoteAggregator.majority([99, 98, 97], 3)).toBe(0)
  })

  it('always returns 0 when there is only one candidate', () => {
    expect(VoteAggregator.majority([0, 0, 0], 1)).toBe(0)
  })
})

describe('VoteAggregator.confidence', () => {
  it('returns null for empty votes', () => {
    expect(VoteAggregator.confidence([], 3)).toBeNull()
  })

  it('returns null for a single vote — insufficient sample for confidence', () => {
    expect(VoteAggregator.confidence([2], 3)).toBeNull()
  })

  it('returns 1.0 for unanimous agreement across multiple votes', () => {
    expect(VoteAggregator.confidence([1, 1, 1], 3)).toBe(1)
  })

  it('returns 0.67 for 2 of 3 in agreement', () => {
    expect(VoteAggregator.confidence([0, 1, 1], 3)).toBeCloseTo(0.667, 2)
  })

  it('returns 0.5 for perfect tie', () => {
    expect(VoteAggregator.confidence([0, 1], 2)).toBe(0.5)
  })

  it('ignores out-of-range votes when tallying', () => {
    expect(VoteAggregator.confidence([0, 0, 99], 3)).toBeCloseTo(0.667, 2)
  })

  it('returns 1.0 for two-vote unanimous agreement', () => {
    expect(VoteAggregator.confidence([0, 0], 2)).toBe(1)
  })

  it('returns fractional confidence for three-way spread across all candidates', () => {
    expect(VoteAggregator.confidence([0, 1, 2], 3)).toBeCloseTo(1 / 3, 2)
  })

  it('returns 0 when all votes are out of range — no valid candidate is credited', () => {
    expect(VoteAggregator.confidence([99, 98], 3)).toBe(0)
  })
})

import { describe, it, expect } from 'vitest'
import { readCommodityN, stripCommodityN, COMMODITY_N_MAX } from '../commodity-params'

describe('readCommodityN', () => {
  describe('absent or non-activating :n= returns 1 (single-run default)', () => {
    it.each([undefined, ''])('returns 1 for %p (falsy input)', input => {
      expect(readCommodityN(input)).toBe(1)
    })

    it('returns 1 when :n= is absent', () => {
      expect(readCommodityN('/chat List 3 colors')).toBe(1)
    })

    it.each([
      ['/chat :n=1 query', 1],
      ['/chat :n=0 query', 0],
    ])('returns 1 for below-minimum value :n=%i', (cmd, _n) => {
      expect(readCommodityN(cmd)).toBe(1)
    })

    it('returns 1 for :n= with no digit (malformed token)', () => {
      expect(readCommodityN('/chat :n= query')).toBe(1)
    })
  })

  describe('parses valid commodity N values (2 ≤ N ≤ COMMODITY_N_MAX)', () => {
    it.each([
      ['/chat :n=2 List colors', 2],
      ['/chat :n=3 List fruits', 3],
      ['/chat :n=5 query', 5],
      ['/claude :n=3 analyze', 3],
      [`/chat :n=${COMMODITY_N_MAX} query`, COMMODITY_N_MAX],
    ])('"%s" → %i', (cmd, expected) => {
      expect(readCommodityN(cmd)).toBe(expected)
    })
  })

  describe('all LLM command families parse commodity :n= uniformly', () => {
    it.each([
      '/chat :n=3 query',
      '/chatgpt :n=3 query',
      '/claude :n=3 query',
      '/deepseek :n=3 query',
      '/yandexgpt :n=3 query',
      '/perplexity :n=3 query',
      '/custom :n=3 query',
    ])('"%s" → 3', cmd => {
      expect(readCommodityN(cmd)).toBe(3)
    })
  })

  describe('clamps :n=N to COMMODITY_N_MAX when N exceeds the cap', () => {
    it.each([COMMODITY_N_MAX + 1, 100, 999])('clamps :n=%i to COMMODITY_N_MAX', n => {
      expect(readCommodityN(`/chat :n=${n} query`)).toBe(COMMODITY_N_MAX)
    })
  })

  describe('non-commodity cell prefixes always return 1 regardless of :n= value', () => {
    it.each([
      '/elect :n=3',
      `/elect :n=${COMMODITY_N_MAX}`,
      '/validate :n=2 criterion',
      `/validate :n=${COMMODITY_N_MAX} criterion`,
      '/refine :n=3',
      '/foreach :n=3 items',
      '/steps :n=2',
      '/switch :n=5 condition',
      '/case :n=3 label',
      '/summarize :n=3 text',
      '/memorize :n=2 content',
      '/outline :n=3 --summarize text',
    ])('"%s" → 1', cmd => {
      expect(readCommodityN(cmd)).toBe(1)
    })
  })

  it.each(['/refinement :n=3', '/elective :n=3', '/validateResult :n=3'])(
    'does not treat a neighboring dynamic alias as a reserved control command: %s',
    command => expect(readCommodityN(command)).toBe(3),
  )
})

describe('stripCommodityN', () => {
  it.each([
    [':n=2 List 3 colors', 'List 3 colors'],
    ['prefix :n=3  suffix', 'prefix suffix'],
    ['query :n=2', 'query'],
    ['/chat :n=3 do this', '/chat do this'],
  ])('strips :n=N from "%s" → "%s"', (input, expected) => {
    expect(stripCommodityN(input)).toBe(expected)
  })

  it('returns unchanged text when :n= is absent', () => {
    expect(stripCommodityN('List 3 colors')).toBe('List 3 colors')
  })

  it.each([undefined, ''])('returns empty string for %p', input => {
    expect(stripCommodityN(input)).toBe('')
  })
})

describe('COMMODITY_N_MAX', () => {
  it('is a positive integer ≥ 2', () => {
    expect(typeof COMMODITY_N_MAX).toBe('number')
    expect(Number.isInteger(COMMODITY_N_MAX)).toBe(true)
    expect(COMMODITY_N_MAX).toBeGreaterThanOrEqual(2)
  })
})

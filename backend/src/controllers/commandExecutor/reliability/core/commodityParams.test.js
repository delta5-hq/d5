import {readCommodityN, stripCommodityN, COMMODITY_N_MAX} from './commodityParams'

describe('readCommodityN', () => {
  describe('absent or non-activating :n= returns 1 (single-run default)', () => {
    it.each([null, undefined, ''])('returns 1 for %p (falsy input)', input => {
      expect(readCommodityN(input)).toBe(1)
    })

    it('returns 1 when :n= is absent', () => {
      expect(readCommodityN('/chat List 3 colors')).toBe(1)
    })

    it.each([
      ['/chat :n=1 query', 1],
      ['/chat :n=0 query', 0],
      ['/chat :n=-1 query', -1],
    ])('returns 1 for below-minimum value :n=%i', cmd => {
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
      '/claude :n=3 query',
      '/deepseek :n=3 query',
      '/perplexity :n=3 query',
      '/qwen :n=3 query',
      '/scholar :n=3 query',
      '/web :n=3 query',
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

  describe('multiple :n= tokens — first occurrence wins (non-global regex)', () => {
    it('returns the N from the first :n= token when two appear', () => {
      expect(readCommodityN('/chat :n=2 task :n=5 more')).toBe(2)
    })
  })

  describe('non-commodity cell prefixes always return 1 regardless of :n= value', () => {
    it.each([
      '/refine :n=3',
      `/refine :n=${COMMODITY_N_MAX}`,
      '/validate :n=2 criterion',
      `/validate :n=${COMMODITY_N_MAX} criterion`,
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

  it('returns empty string when the input contains only a :n=N token', () => {
    expect(stripCommodityN(':n=3')).toBe('')
  })

  it('strips only the first :n=N token when multiple appear — non-global regex', () => {
    expect(stripCommodityN('task :n=2 text :n=3 more')).toBe('task text :n=3 more')
  })

  it.each([null, undefined, ''])('returns empty string for %p', input => {
    expect(stripCommodityN(input)).toBe('')
  })
})

describe('COMMODITY_N_MAX', () => {
  it('is the exact upper bound that the commodity fork path clamps :n=N to', () => {
    expect(typeof COMMODITY_N_MAX).toBe('number')
    expect(Number.isInteger(COMMODITY_N_MAX)).toBe(true)
    expect(COMMODITY_N_MAX).toBe(10)
  })
})

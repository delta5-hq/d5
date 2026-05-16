import {synthesizeForkContent} from './ForkContentSynthesizer'

describe('synthesizeForkContent', () => {
  it('returns non-empty content for any non-empty input', () => {
    expect(synthesizeForkContent('any prompt').length).toBeGreaterThan(0)
  })

  it('is deterministic for the same corpus', () => {
    const a = synthesizeForkContent('List 3 colors')
    const b = synthesizeForkContent('List 3 colors')
    expect(a).toBe(b)
  })

  it('produces different content for different corpora', () => {
    const a = synthesizeForkContent('List 3 colors')
    const b = synthesizeForkContent('List 3 fruits')
    expect(a).not.toBe(b)
  })

  it('previews the prompt without leaking the full corpus past the cap', () => {
    const long = 'word '.repeat(200)
    const out = synthesizeForkContent(long)
    expect(out.length).toBeLessThan(long.length)
  })

  it('returns non-empty content even for an empty corpus', () => {
    expect(synthesizeForkContent('').length).toBeGreaterThan(0)
  })

  it('collapses internal whitespace in the preview', () => {
    expect(synthesizeForkContent('a\n\n\t b   c')).not.toMatch(/\n|\t/)
  })

  it('partitions the output space across distinct corpora', () => {
    const samples = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
    const variants = new Set(samples.map(s => synthesizeForkContent(s).split(' ')[0]))
    expect(variants.size).toBeGreaterThan(1)
  })
})

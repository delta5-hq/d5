import {stripReliabilitySuffix, REFINED_SUFFIX, REFINE_FAILURE_SUFFIX} from './reliabilitySuffix'

describe('stripReliabilitySuffix', () => {
  it('returns empty string for falsy input', () => {
    expect(stripReliabilitySuffix('')).toBe('')
    expect(stripReliabilitySuffix(null)).toBe('')
    expect(stripReliabilitySuffix(undefined)).toBe('')
  })

  it('strips current symbol-only suffixes', () => {
    expect(stripReliabilitySuffix('My title [✓]')).toBe('My title')
    expect(stripReliabilitySuffix('My title [✗]')).toBe('My title')
    expect(stripReliabilitySuffix('My title [⚠]')).toBe('My title')
  })

  it('strips legacy English suffixes left over from the deleted reliability subsystem', () => {
    expect(stripReliabilitySuffix('Foo [✓ 2/3 best of 3]')).toBe('Foo')
    expect(stripReliabilitySuffix('Foo [✓ 2/3 best of 3 · 0.92]')).toBe('Foo')
    expect(stripReliabilitySuffix('Foo [✗ 0/3 passed]')).toBe('Foo')
    expect(stripReliabilitySuffix('Foo [✓ 1/2 first-survivor · no judge]')).toBe('Foo')
    expect(stripReliabilitySuffix('Foo [✓ refined]')).toBe('Foo')
    expect(stripReliabilitySuffix('Foo [✗ refine failed]')).toBe('Foo')
  })

  it('leaves titles without a recognized suffix untouched', () => {
    expect(stripReliabilitySuffix('My title')).toBe('My title')
    expect(stripReliabilitySuffix('My title [done]')).toBe('My title [done]')
  })

  it('only strips the trailing suffix, not internal occurrences', () => {
    expect(stripReliabilitySuffix('[✓] foo [✗]')).toBe('[✓] foo')
  })
})

describe('suffix constants', () => {
  it('refined and refine-failure markers are locale-neutral symbols', () => {
    expect(REFINED_SUFFIX).toBe('[✓]')
    expect(REFINE_FAILURE_SUFFIX).toBe('[✗]')
  })
})

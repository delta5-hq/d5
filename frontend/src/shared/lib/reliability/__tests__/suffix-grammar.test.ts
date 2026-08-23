import { describe, it, expect } from 'vitest'
import shapes from '../suffix-grammar-shapes.json'
import backendShapes from '../../../../../../backend/src/controllers/commandExecutor/reliability/core/suffixGrammarShapes.json'
import {
  HISTORICAL_SUFFIX_SHAPES,
  ENGINE_SUFFIX_SHAPES,
  HISTORICAL_SUFFIX_RE,
  ENGINE_SUFFIX_RE,
} from '../suffix-grammar'

const HISTORICAL_CANONICAL_TITLES = [
  ['best-of-N success', '/chat list [✓ 3/3 best of 3]'],
  ['best-of-N with confidence score', '/chat list [✓ 3/3 best of 3 · 0.92]'],
  ['first-survivor without judge', '/chat list [✓ 2/2 first-survivor · no judge]'],
  ['first-survivor with judge error', '/chat list [✓ 1/2 first-survivor · judge auth error]'],
  ['passed fraction', '/chat list [✗ 0/2 passed]'],
  ['electd (v-pre-1)', '/chat list [✓ electd]'],
  ['elect failed (v-pre-1)', '/chat list [✗ elect failed]'],
  ['validate retry (v1)', '/chat list [✓ retry-2]'],
  ['validate exhausted (v1)', '/chat list [✗ 3 attempts]'],
  ['invalid criterion (v1)', '/chat list [✗ invalid]'],
  ['no judge signal (v1)', '/chat list [⚠ no judge signal]'],
  ['fallback winner single-digit (v1)', '/chat list [⚠ fallback: 0/3 passed; chose fork-1]'],
  ['fallback winner multi-digit (v1)', '/chat list [⚠ fallback: 0/12 passed; chose fork-11]'],
] as const satisfies ReadonlyArray<[string, string]>

const ENGINE_CANONICAL_TITLES = [
  ['commodity/elect partial with degraded judge input', '/chat list [✓ 2/3 ⚠]'],
  ['commodity/elect all K of N succeeded', '/chat list [✓ 2/3]'],
  ['validate passed after N retries', '/chat list [✓ +2]'],
  ['validate passed on first attempt', '/chat list [✓]'],
  ['elect or commodity zero of N eligible', '/chat list [✗ 0/3]'],
  ['validate all retries exhausted', '/chat list [✗ 3×]'],
  ['validate retry withheld', '/chat list [✗ ⊘]'],
  ['validate invalid criterion', '/chat list [✗ !]'],
  ['elect no judge signal in strict mode', '/chat list [⚠ ∅]'],
  ['elect fallback winner committed', '/chat list [⚠ 0/3]'],
] as const satisfies ReadonlyArray<[string, string]>

// Shapes that resemble engine suffixes structurally but are NOT known suffix tokens.
// Verifies the regex is tight — not a broad catch-all.

const ENGINE_NON_MATCHING_TITLES = [
  ['freeform ✓ text', '/chat list [✓ approved by manager]'],
  ['freeform ✗ text', '/chat list [✗ invalid output]'],
  ['freeform ⚠ text', '/chat list [⚠ needs attention]'],
  ['bare ✗ no content', '/chat list [✗]'],
  ['✓ + without trailing digit', '/chat list [✓ +]'],
  ['✗ lone number without ×', '/chat list [✗ 3]'],
  ['✗ × without leading number', '/chat list [✗ ×]'],
  ['⚠ non-zero eligible fraction', '/chat list [⚠ 1/3]'],
  ['⚠ ∅ followed by extra text', '/chat list [⚠ ∅ extra]'],
  ['✓ K/N ⚠ followed by extra text', '/chat list [✓ 2/3 ⚠ extra]'],
  ['bracket in mid-title not trailing', '[topic] analysis'],
  ['✗ non-zero failure fraction (engine produces only 0/N)', '/chat list [✗ 1/3]'],
] as const satisfies ReadonlyArray<[string, string]>

describe('suffix-grammar-shapes.json canonical source', () => {
  it('historicalSuffixShapes is a non-empty string array', () => {
    expect(Array.isArray(shapes.historicalSuffixShapes)).toBe(true)
    expect(shapes.historicalSuffixShapes.length).toBeGreaterThan(0)
    expect(shapes.historicalSuffixShapes.every((s: unknown) => typeof s === 'string')).toBe(true)
  })

  it('engineSuffixShapes is a non-empty string array', () => {
    expect(Array.isArray(shapes.engineSuffixShapes)).toBe(true)
    expect(shapes.engineSuffixShapes.length).toBeGreaterThan(0)
    expect(shapes.engineSuffixShapes.every((s: unknown) => typeof s === 'string')).toBe(true)
  })

  it('HISTORICAL_SUFFIX_SHAPES surfaces the canonical historical shapes', () => {
    expect([...HISTORICAL_SUFFIX_SHAPES]).toEqual([...shapes.historicalSuffixShapes])
  })

  it('ENGINE_SUFFIX_SHAPES surfaces the canonical engine shapes', () => {
    expect([...ENGINE_SUFFIX_SHAPES]).toEqual([...shapes.engineSuffixShapes])
  })

  it('historicalSuffixShapes is identical to the backend canonical JSON — frontend copy is in sync', () => {
    expect([...shapes.historicalSuffixShapes]).toEqual([...backendShapes.historicalSuffixShapes])
  })

  it('engineSuffixShapes is identical to the backend canonical JSON — frontend copy is in sync', () => {
    expect([...shapes.engineSuffixShapes]).toEqual([...backendShapes.engineSuffixShapes])
  })

  it('exposes exactly the two canonical shape-set keys — no extra or missing top-level keys', () => {
    expect(Object.keys(shapes).sort()).toEqual(['engineSuffixShapes', 'historicalSuffixShapes'])
  })
})

describe('HISTORICAL_SUFFIX_SHAPES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(HISTORICAL_SUFFIX_SHAPES)).toBe(true)
    expect(HISTORICAL_SUFFIX_SHAPES.length).toBeGreaterThan(0)
  })

  it('is frozen — the exported array cannot be mutated at runtime', () => {
    expect(Object.isFrozen(HISTORICAL_SUFFIX_SHAPES)).toBe(true)
  })

  it('every entry is a non-empty string', () => {
    for (const shape of HISTORICAL_SUFFIX_SHAPES) {
      expect(typeof shape).toBe('string')
      expect(shape.length).toBeGreaterThan(0)
    }
  })

  it('every entry compiles as a valid RegExp without throwing', () => {
    for (const shape of HISTORICAL_SUFFIX_SHAPES) {
      expect(() => new RegExp(shape, 'i')).not.toThrow()
    }
  })

  it('no shape pattern matches the empty string — strip leaves clean titles untouched', () => {
    for (const shape of HISTORICAL_SUFFIX_SHAPES) {
      expect(new RegExp(shape, 'i').test('')).toBe(false)
    }
  })

  it('contains no duplicate entries', () => {
    const unique = new Set(HISTORICAL_SUFFIX_SHAPES)
    expect(unique.size).toBe(HISTORICAL_SUFFIX_SHAPES.length)
  })

  it('no later shape is a string-prefix of an earlier shape — ordering is most-specific-first', () => {
    for (let i = 0; i < HISTORICAL_SUFFIX_SHAPES.length; i++) {
      for (let j = i + 1; j < HISTORICAL_SUFFIX_SHAPES.length; j++) {
        const earlier = HISTORICAL_SUFFIX_SHAPES[i]
        const later = HISTORICAL_SUFFIX_SHAPES[j]
        if (later.startsWith(earlier)) {
          throw new Error(
            `Ordering violation: HISTORICAL_SUFFIX_SHAPES[${j}] "${later}" starts with ` +
              `HISTORICAL_SUFFIX_SHAPES[${i}] "${earlier}" — place the more-specific shape first`,
          )
        }
      }
    }
  })
})

describe('ENGINE_SUFFIX_SHAPES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(ENGINE_SUFFIX_SHAPES)).toBe(true)
    expect(ENGINE_SUFFIX_SHAPES.length).toBeGreaterThan(0)
  })

  it('is frozen — the exported array cannot be mutated at runtime', () => {
    expect(Object.isFrozen(ENGINE_SUFFIX_SHAPES)).toBe(true)
  })

  it('every entry is a non-empty string', () => {
    for (const shape of ENGINE_SUFFIX_SHAPES) {
      expect(typeof shape).toBe('string')
      expect(shape.length).toBeGreaterThan(0)
    }
  })

  it('every entry compiles as a valid RegExp without throwing', () => {
    for (const shape of ENGINE_SUFFIX_SHAPES) {
      expect(() => new RegExp(shape)).not.toThrow()
    }
  })

  it('no shape pattern matches the empty string — strip leaves clean titles untouched', () => {
    for (const shape of ENGINE_SUFFIX_SHAPES) {
      expect(new RegExp(shape).test('')).toBe(false)
    }
  })

  it('contains no duplicate entries', () => {
    const unique = new Set(ENGINE_SUFFIX_SHAPES)
    expect(unique.size).toBe(ENGINE_SUFFIX_SHAPES.length)
  })

  it('no later shape is a string-prefix of an earlier shape — ordering is most-specific-first', () => {
    for (let i = 0; i < ENGINE_SUFFIX_SHAPES.length; i++) {
      for (let j = i + 1; j < ENGINE_SUFFIX_SHAPES.length; j++) {
        const earlier = ENGINE_SUFFIX_SHAPES[i]
        const later = ENGINE_SUFFIX_SHAPES[j]
        if (later.startsWith(earlier)) {
          throw new Error(
            `Ordering violation: ENGINE_SUFFIX_SHAPES[${j}] "${later}" starts with ` +
              `ENGINE_SUFFIX_SHAPES[${i}] "${earlier}" — place the more-specific shape first`,
          )
        }
      }
    }
  })
})

describe('HISTORICAL_SUFFIX_RE', () => {
  it('is a compiled RegExp instance', () => {
    expect(HISTORICAL_SUFFIX_RE).toBeInstanceOf(RegExp)
  })

  it('has the i flag for case-insensitive matching of legacy prose', () => {
    expect(HISTORICAL_SUFFIX_RE.flags).toContain('i')
  })

  it('does not have the g flag — stateful lastIndex would corrupt repeated strip calls', () => {
    expect(HISTORICAL_SUFFIX_RE.flags).not.toContain('g')
  })

  it('returns the same result across repeated test() calls on the same input', () => {
    const title = '/chat list [✓ electd]'
    for (let i = 0; i < 4; i++) {
      expect(HISTORICAL_SUFFIX_RE.test(title)).toBe(true)
    }
  })

  it('does not match empty string', () => {
    expect(HISTORICAL_SUFFIX_RE.test('')).toBe(false)
  })

  it('tolerates trailing whitespace after the closing bracket', () => {
    expect(HISTORICAL_SUFFIX_RE.test('/chat list [✓ electd] ')).toBe(true)
  })

  it('tolerates multiple spaces between title text and the opening bracket', () => {
    expect(HISTORICAL_SUFFIX_RE.test('/chat list  [✓ electd]')).toBe(true)
  })

  it('matches when there is no space between title text and the opening bracket', () => {
    expect(HISTORICAL_SUFFIX_RE.test('/chat list[✓ electd]')).toBe(true)
  })

  it('matches when a tab precedes the opening bracket', () => {
    expect(HISTORICAL_SUFFIX_RE.test('/chat list	[✓ electd]')).toBe(true)
  })

  describe('matches each historical canonical suffix token when trailing a title', () => {
    it.each(HISTORICAL_CANONICAL_TITLES)('%s', (_label, title) => {
      expect(HISTORICAL_SUFFIX_RE.test(title)).toBe(true)
    })
  })

  describe('matches HISTORICAL suffix on a suffix-only title (no base text)', () => {
    it.each(HISTORICAL_CANONICAL_TITLES)('%s', (_label, title) => {
      const suffixOnly = title.replace(/^\/chat list /, '')
      expect(HISTORICAL_SUFFIX_RE.test(suffixOnly)).toBe(true)
    })
  })

  describe('case-insensitive matching — i flag covers capitalized legacy prose', () => {
    it.each([
      ['uppercase BEST OF', '/chat list [✓ 2/2 BEST OF 2]'],
      ['titlecase Electd', '/chat list [✓ Electd]'],
      ['titlecase Elect Failed', '/chat list [✗ Elect Failed]'],
      ['uppercase PASSED', '/chat list [✗ 0/2 PASSED]'],
      ['uppercase FIRST-SURVIVOR', '/chat list [✓ 1/2 FIRST-SURVIVOR · no judge]'],
    ] as const satisfies ReadonlyArray<[string, string]>)('%s', (_label, title) => {
      expect(HISTORICAL_SUFFIX_RE.test(title)).toBe(true)
    })
  })

  describe('does not match current engine suffix tokens — sets are disjoint', () => {
    it.each(ENGINE_CANONICAL_TITLES)('%s', (_label, title) => {
      expect(HISTORICAL_SUFFIX_RE.test(title)).toBe(false)
    })
  })

  it('does not match plain title with no brackets', () => {
    expect(HISTORICAL_SUFFIX_RE.test('Normal task')).toBe(false)
  })

  it('does not match mid-title bracket that is not trailing', () => {
    expect(HISTORICAL_SUFFIX_RE.test('[✓ electd] analysis')).toBe(false)
  })
})

describe('ENGINE_SUFFIX_RE', () => {
  it('is a compiled RegExp instance', () => {
    expect(ENGINE_SUFFIX_RE).toBeInstanceOf(RegExp)
  })

  it('does not have the i flag — engine shapes are locale-neutral symbols with no case variants', () => {
    expect(ENGINE_SUFFIX_RE.flags).not.toContain('i')
  })

  it('does not have the g flag — stateful lastIndex would corrupt repeated strip calls', () => {
    expect(ENGINE_SUFFIX_RE.flags).not.toContain('g')
  })

  it('returns the same result across repeated test() calls on the same input', () => {
    const title = '/chat list [✓ 2/3]'
    for (let i = 0; i < 4; i++) {
      expect(ENGINE_SUFFIX_RE.test(title)).toBe(true)
    }
  })

  it('does not match empty string', () => {
    expect(ENGINE_SUFFIX_RE.test('')).toBe(false)
  })

  it('tolerates trailing whitespace after the closing bracket', () => {
    expect(ENGINE_SUFFIX_RE.test('/chat list [✓] ')).toBe(true)
  })

  it('tolerates multiple spaces between title text and the opening bracket', () => {
    expect(ENGINE_SUFFIX_RE.test('/chat list  [✓]')).toBe(true)
  })

  it('matches when there is no space between title text and the opening bracket', () => {
    expect(ENGINE_SUFFIX_RE.test('/chat list[✓]')).toBe(true)
  })

  it('matches when a tab precedes the opening bracket', () => {
    expect(ENGINE_SUFFIX_RE.test('/chat list	[✓]')).toBe(true)
  })

  describe('matches each engine canonical suffix token when trailing a title', () => {
    it.each(ENGINE_CANONICAL_TITLES)('%s', (_label, title) => {
      expect(ENGINE_SUFFIX_RE.test(title)).toBe(true)
    })
  })

  describe('matches engine suffix on a suffix-only title (no base text)', () => {
    it.each(ENGINE_CANONICAL_TITLES)('%s', (_label, title) => {
      const suffixOnly = title.replace(/^\/chat list /, '')
      expect(ENGINE_SUFFIX_RE.test(suffixOnly)).toBe(true)
    })
  })

  describe('matches single-fork N=1 tokens', () => {
    it.each([
      ['all 1 of 1 succeeded', '/chat list [✓ 1/1]'],
      ['all 1 of 1 failed', '/chat list [✗ 0/1]'],
      ['fallback committed 0 of 1', '/chat list [⚠ 0/1]'],
      ['1 of 1 with degraded judge input', '/chat list [✓ 1/1 ⚠]'],
    ] as const satisfies ReadonlyArray<[string, string]>)('%s', (_label, title) => {
      expect(ENGINE_SUFFIX_RE.test(title)).toBe(true)
    })
  })

  describe('matches large digit counts — \\d+ is unbounded', () => {
    it.each([
      ['validate passed after many retries', '/chat list [✓ +10]'],
      ['validate all 999 retries exhausted', '/chat list [✗ 999×]'],
      ['commodity large N all succeeded', '/chat list [✓ 99/100]'],
      ['commodity large N all failed', '/chat list [✗ 0/100]'],
      ['commodity large N partial with warning', '/chat list [✓ 99/100 ⚠]'],
      ['elect fallback large N', '/chat list [⚠ 0/100]'],
    ] as const satisfies ReadonlyArray<[string, string]>)('%s', (_label, title) => {
      expect(ENGINE_SUFFIX_RE.test(title)).toBe(true)
    })
  })

  describe('does not match structurally-similar patterns that are not suffix tokens', () => {
    it.each(ENGINE_NON_MATCHING_TITLES)('%s', (_label, title) => {
      expect(ENGINE_SUFFIX_RE.test(title)).toBe(false)
    })
  })

  describe('does not match historical suffix tokens — sets are disjoint', () => {
    it.each(HISTORICAL_CANONICAL_TITLES)('%s', (_label, title) => {
      expect(ENGINE_SUFFIX_RE.test(title)).toBe(false)
    })
  })

  it('does not match plain title with no brackets', () => {
    expect(ENGINE_SUFFIX_RE.test('Normal task')).toBe(false)
  })

  it('does not match mid-title bracket that is not trailing', () => {
    expect(ENGINE_SUFFIX_RE.test('[✓ 2/3] analysis')).toBe(false)
  })
})

describe('HISTORICAL_SUFFIX_RE strip behaviour', () => {
  describe('strips each canonical suffix leaving only the base title', () => {
    it.each(HISTORICAL_CANONICAL_TITLES)('%s', (_label, title) => {
      expect(title.replace(HISTORICAL_SUFFIX_RE, '')).toBe('/chat list')
    })
  })

  it('strip is idempotent — applying to a clean title returns it unchanged', () => {
    expect('/chat list'.replace(HISTORICAL_SUFFIX_RE, '')).toBe('/chat list')
  })

  it('strips suffix-only input to empty string', () => {
    expect('[✓ electd]'.replace(HISTORICAL_SUFFIX_RE, '')).toBe('')
  })

  it('preserves a bracket in the middle of the title — only trailing suffix is consumed', () => {
    expect('[topic] /chat list [✓ electd]'.replace(HISTORICAL_SUFFIX_RE, '')).toBe('[topic] /chat list')
  })

  it('does not alter a title whose bracket content is not a known suffix', () => {
    expect('/chat list [custom note]'.replace(HISTORICAL_SUFFIX_RE, '')).toBe('/chat list [custom note]')
  })
})

describe('ENGINE_SUFFIX_RE strip behaviour', () => {
  describe('strips each canonical suffix leaving only the base title', () => {
    it.each(ENGINE_CANONICAL_TITLES)('%s', (_label, title) => {
      expect(title.replace(ENGINE_SUFFIX_RE, '')).toBe('/chat list')
    })
  })

  it('strip is idempotent — applying to a clean title returns it unchanged', () => {
    expect('/chat list'.replace(ENGINE_SUFFIX_RE, '')).toBe('/chat list')
  })

  it('strips suffix-only input to empty string', () => {
    expect('[✓ 2/3]'.replace(ENGINE_SUFFIX_RE, '')).toBe('')
  })

  it('preserves a bracket in the middle of the title — only trailing suffix is consumed', () => {
    expect('[topic] /chat list [✓ 2/3]'.replace(ENGINE_SUFFIX_RE, '')).toBe('[topic] /chat list')
  })

  it('does not alter a title whose bracket content is not a known suffix', () => {
    expect('/chat list [custom note]'.replace(ENGINE_SUFFIX_RE, '')).toBe('/chat list [custom note]')
  })

  it('consumes leading whitespace between base title and bracket — result is base without trailing space', () => {
    expect('/chat list  [✓ 2/3]'.replace(ENGINE_SUFFIX_RE, '')).toBe('/chat list')
  })
})

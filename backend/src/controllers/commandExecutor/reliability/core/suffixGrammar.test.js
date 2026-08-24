import fs from 'fs'
import path from 'path'
import shapes from './suffixGrammarShapes.json'
import {HISTORICAL_SUFFIX_SHAPES, ENGINE_SUFFIX_SHAPES, HISTORICAL_SUFFIX_RE, ENGINE_SUFFIX_RE} from './suffixGrammar'

const frontendShapes = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../../../../frontend/src/shared/lib/reliability/suffix-grammar-shapes.json'),
    'utf8',
  ),
)

const HISTORICAL_CANONICAL_TITLES = [
  ['best-of-N success', 'Task [✓ 3/3 best of 3]'],
  ['best-of-N with confidence score', 'Task [✓ 3/3 best of 3 · 0.92]'],
  ['first-survivor without judge', 'Task [✓ 2/2 first-survivor · no judge]'],
  ['first-survivor with judge error', 'Task [✓ 1/2 first-survivor · judge auth error]'],
  ['passed fraction', 'Task [✗ 0/2 passed]'],
  ['electd (v-pre-1)', 'Task [✓ electd]'],
  ['elect failed (v-pre-1)', 'Task [✗ elect failed]'],
  ['validate retry (v1)', 'Task [✓ retry-2]'],
  ['validate exhausted (v1)', 'Task [✗ 3 attempts]'],
  ['invalid criterion (v1)', 'Task [✗ invalid]'],
  ['no judge signal (v1)', 'Task [⚠ no judge signal]'],
  ['fallback winner single-digit (v1)', 'Task [⚠ fallback: 0/3 passed; chose fork-1]'],
  ['fallback winner multi-digit (v1)', 'Task [⚠ fallback: 0/12 passed; chose fork-11]'],
]

const ENGINE_CANONICAL_TITLES = [
  ['commodity partial execution', 'Task [↻ 2/3 ⚠]'],
  ['commodity all K of N returned', 'Task [↻ 2/3]'],
  ['elect partial with degraded judge input', 'Task [✓ 2/3 ⚠]'],
  ['elect K of N eligible', 'Task [✓ 2/3]'],
  ['validate passed after N retries', 'Task [✓ +2]'],
  ['refine passed after N attempts', 'Task [✓ 2×]'],
  ['validate passed on first attempt', 'Task [✓]'],
  ['elect or commodity zero of N eligible', 'Task [✗ 0/3]'],
  ['validate all retries exhausted', 'Task [✗ 3×]'],
  ['validate retry withheld', 'Task [✗ ⊘]'],
  ['validate invalid criterion', 'Task [✗ !]'],
  ['validate predicate failed', 'Task [✗]'],
  ['elect no judge signal in strict mode', 'Task [⚠ ∅]'],
  ['elect fallback winner committed', 'Task [⚠ 0/3]'],
]

// Shapes that resemble engine suffixes structurally but are NOT known suffix tokens.
// Verifies the regex is tight — not a broad catch-all.

const ENGINE_NON_MATCHING_TITLES = [
  ['freeform ✓ text', 'Task [✓ approved by manager]'],
  ['freeform ✗ text', 'Task [✗ invalid output]'],
  ['freeform ⚠ text', 'Task [⚠ needs attention]'],
  ['✓ + without trailing digit', 'Task [✓ +]'],
  ['✗ lone number without ×', 'Task [✗ 3]'],
  ['✗ × without leading number', 'Task [✗ ×]'],
  ['⚠ non-zero eligible fraction', 'Task [⚠ 1/3]'],
  ['⚠ ∅ followed by extra text', 'Task [⚠ ∅ extra]'],
  ['✓ K/N ⚠ followed by extra text', 'Task [✓ 2/3 ⚠ extra]'],
  ['bracket in mid-title not trailing', '[topic] analysis'],
  ['✗ non-zero failure fraction (engine produces only 0/N)', 'Task [✗ 1/3]'],
]

describe('suffixGrammarShapes.json', () => {
  it('historicalSuffixShapes is a non-empty string array', () => {
    expect(Array.isArray(shapes.historicalSuffixShapes)).toBe(true)
    expect(shapes.historicalSuffixShapes.length).toBeGreaterThan(0)
    expect(shapes.historicalSuffixShapes.every(s => typeof s === 'string')).toBe(true)
  })

  it('engineSuffixShapes is a non-empty string array', () => {
    expect(Array.isArray(shapes.engineSuffixShapes)).toBe(true)
    expect(shapes.engineSuffixShapes.length).toBeGreaterThan(0)
    expect(shapes.engineSuffixShapes.every(s => typeof s === 'string')).toBe(true)
  })

  it('HISTORICAL_SUFFIX_SHAPES is the same array as historicalSuffixShapes', () => {
    expect(HISTORICAL_SUFFIX_SHAPES).toEqual(shapes.historicalSuffixShapes)
  })

  it('ENGINE_SUFFIX_SHAPES is the same array as engineSuffixShapes', () => {
    expect(ENGINE_SUFFIX_SHAPES).toEqual(shapes.engineSuffixShapes)
  })

  it('historicalSuffixShapes is identical to the frontend canonical JSON — both copies are in sync', () => {
    expect([...shapes.historicalSuffixShapes]).toEqual([...frontendShapes.historicalSuffixShapes])
  })

  it('engineSuffixShapes is identical to the frontend canonical JSON — both copies are in sync', () => {
    expect([...shapes.engineSuffixShapes]).toEqual([...frontendShapes.engineSuffixShapes])
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
    const title = 'Task [✓ electd]'
    for (let i = 0; i < 4; i++) {
      expect(HISTORICAL_SUFFIX_RE.test(title)).toBe(true)
    }
  })

  it('does not match empty string', () => {
    expect(HISTORICAL_SUFFIX_RE.test('')).toBe(false)
  })

  it('tolerates trailing whitespace after the closing bracket', () => {
    expect(HISTORICAL_SUFFIX_RE.test('Task [✓ electd] ')).toBe(true)
  })

  it('tolerates multiple spaces between title text and the opening bracket', () => {
    expect(HISTORICAL_SUFFIX_RE.test('Task  [✓ electd]')).toBe(true)
  })

  it('matches when there is no space between title text and the opening bracket', () => {
    expect(HISTORICAL_SUFFIX_RE.test('Task[✓ electd]')).toBe(true)
  })

  it('matches when a tab precedes the opening bracket', () => {
    expect(HISTORICAL_SUFFIX_RE.test('Task	[✓ electd]')).toBe(true)
  })

  describe('matches each historical canonical suffix token when trailing a title', () => {
    it.each(HISTORICAL_CANONICAL_TITLES)('%s', (_, title) => {
      expect(HISTORICAL_SUFFIX_RE.test(title)).toBe(true)
    })
  })

  describe('matches HISTORICAL suffix on a suffix-only title (no base text)', () => {
    it.each(HISTORICAL_CANONICAL_TITLES)('%s', (_, title) => {
      const suffixOnly = title.replace(/^Task /, '')
      expect(HISTORICAL_SUFFIX_RE.test(suffixOnly)).toBe(true)
    })
  })

  describe('case-insensitive matching — i flag covers capitalized legacy prose', () => {
    it.each([
      ['uppercase BEST OF', 'Task [✓ 2/2 BEST OF 2]'],
      ['titlecase Electd', 'Task [✓ Electd]'],
      ['titlecase Elect Failed', 'Task [✗ Elect Failed]'],
      ['uppercase PASSED', 'Task [✗ 0/2 PASSED]'],
      ['uppercase FIRST-SURVIVOR', 'Task [✓ 1/2 FIRST-SURVIVOR · no judge]'],
    ])('%s', (_, title) => {
      expect(HISTORICAL_SUFFIX_RE.test(title)).toBe(true)
    })
  })

  describe('does not match current engine suffix tokens — sets are disjoint', () => {
    it.each(ENGINE_CANONICAL_TITLES)('%s', (_, title) => {
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
    const title = 'Task [✓ 2/3]'
    for (let i = 0; i < 4; i++) {
      expect(ENGINE_SUFFIX_RE.test(title)).toBe(true)
    }
  })

  it('does not match empty string', () => {
    expect(ENGINE_SUFFIX_RE.test('')).toBe(false)
  })

  it('tolerates trailing whitespace after the closing bracket', () => {
    expect(ENGINE_SUFFIX_RE.test('Task [✓] ')).toBe(true)
  })

  it('tolerates multiple spaces between title text and the opening bracket', () => {
    expect(ENGINE_SUFFIX_RE.test('Task  [✓]')).toBe(true)
  })

  it('matches when there is no space between title text and the opening bracket', () => {
    expect(ENGINE_SUFFIX_RE.test('Task[✓]')).toBe(true)
  })

  it('matches when a tab precedes the opening bracket', () => {
    expect(ENGINE_SUFFIX_RE.test('Task	[✓]')).toBe(true)
  })

  describe('matches each engine canonical suffix token when trailing a title', () => {
    it.each(ENGINE_CANONICAL_TITLES)('%s', (_, title) => {
      expect(ENGINE_SUFFIX_RE.test(title)).toBe(true)
    })
  })

  describe('matches engine suffix on a suffix-only title (no base text)', () => {
    it.each(ENGINE_CANONICAL_TITLES)('%s', (_, title) => {
      const suffixOnly = title.replace(/^Task /, '')
      expect(ENGINE_SUFFIX_RE.test(suffixOnly)).toBe(true)
    })
  })

  describe('matches single-fork N=1 tokens', () => {
    it.each([
      ['all 1 of 1 succeeded', 'Task [✓ 1/1]'],
      ['one commodity execution returned', 'Task [↻ 1/1]'],
      ['all 1 of 1 failed', 'Task [✗ 0/1]'],
      ['fallback committed 0 of 1', 'Task [⚠ 0/1]'],
      ['1 of 1 with degraded judge input', 'Task [✓ 1/1 ⚠]'],
    ])('%s', (_, title) => {
      expect(ENGINE_SUFFIX_RE.test(title)).toBe(true)
    })
  })

  describe('matches large digit counts — \\d+ is unbounded', () => {
    it.each([
      ['validate passed after many retries', 'Task [✓ +10]'],
      ['validate all 100 retries exhausted', 'Task [✗ 999×]'],
      ['commodity large N all returned', 'Task [↻ 100/100]'],
      ['commodity large N none returned', 'Task [↻ 0/100 ⚠]'],
      ['commodity large N partial with warning', 'Task [↻ 99/100 ⚠]'],
      ['elect fallback large N', 'Task [⚠ 0/100]'],
    ])('%s', (_, title) => {
      expect(ENGINE_SUFFIX_RE.test(title)).toBe(true)
    })
  })

  describe('does not match structurally-similar patterns that are not suffix tokens', () => {
    it.each(ENGINE_NON_MATCHING_TITLES)('%s', (_, title) => {
      expect(ENGINE_SUFFIX_RE.test(title)).toBe(false)
    })
  })

  describe('does not match historical suffix tokens — sets are disjoint', () => {
    it.each(HISTORICAL_CANONICAL_TITLES)('%s', (_, title) => {
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
    it.each(HISTORICAL_CANONICAL_TITLES)('%s', (_, title) => {
      expect(title.replace(HISTORICAL_SUFFIX_RE, '')).toBe('Task')
    })
  })

  it('strip is idempotent — applying to a clean title returns it unchanged', () => {
    expect('Task'.replace(HISTORICAL_SUFFIX_RE, '')).toBe('Task')
  })

  it('strips suffix-only input to empty string', () => {
    expect('[✓ electd]'.replace(HISTORICAL_SUFFIX_RE, '')).toBe('')
  })

  it('preserves a bracket in the middle of the title — only trailing suffix is consumed', () => {
    expect('[topic] Task [✓ electd]'.replace(HISTORICAL_SUFFIX_RE, '')).toBe('[topic] Task')
  })

  it('does not alter a title whose bracket content is not a known suffix', () => {
    expect('Task [custom note]'.replace(HISTORICAL_SUFFIX_RE, '')).toBe('Task [custom note]')
  })
})

describe('ENGINE_SUFFIX_RE strip behaviour', () => {
  describe('strips each canonical suffix leaving only the base title', () => {
    it.each(ENGINE_CANONICAL_TITLES)('%s', (_, title) => {
      expect(title.replace(ENGINE_SUFFIX_RE, '')).toBe('Task')
    })
  })

  it('strip is idempotent — applying to a clean title returns it unchanged', () => {
    expect('Task'.replace(ENGINE_SUFFIX_RE, '')).toBe('Task')
  })

  it('strips suffix-only input to empty string', () => {
    expect('[✓ 2/3]'.replace(ENGINE_SUFFIX_RE, '')).toBe('')
  })

  it('preserves a bracket in the middle of the title — only trailing suffix is consumed', () => {
    expect('[topic] Task [✓ 2/3]'.replace(ENGINE_SUFFIX_RE, '')).toBe('[topic] Task')
  })

  it('does not alter a title whose bracket content is not a known suffix', () => {
    expect('Task [custom note]'.replace(ENGINE_SUFFIX_RE, '')).toBe('Task [custom note]')
  })

  it('consumes leading whitespace between base title and bracket — result is base without trailing space', () => {
    expect('Task  [✓ 2/3]'.replace(ENGINE_SUFFIX_RE, '')).toBe('Task')
  })
})

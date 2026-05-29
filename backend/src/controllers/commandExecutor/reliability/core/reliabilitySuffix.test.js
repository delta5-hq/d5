import {
  stripReliabilitySuffix,
  appendValidateSuffix,
  appendCommoditySuffix,
  appendRefineSuffix,
  appendInvalidSuffix,
} from './reliabilitySuffix'

// ─── Shared fixture data ──────────────────────────────────────────────────────
// Reused across describe blocks so adding a new suffix shape requires updating one list.

const LEGACY_SUFFIX_VARIANTS = [
  ['best-of with ratio', 'Task [✓ 3/3 best of 3]', 'Task'],
  ['best-of with confidence score', 'Task [✓ 3/3 best of 3 · 0.92]', 'Task'],
  ['passed fraction', 'Task [✗ 0/2 passed]', 'Task'],
  ['first-survivor without judge', 'Task [✓ 2/2 first-survivor · no judge]', 'Task'],
  ['first-survivor with judge error', 'Task [✓ 1/2 first-survivor · judge auth error]', 'Task'],
  ['refined', 'Task [✓ refined]', 'Task'],
  ['refine failed', 'Task [✗ refine failed]', 'Task'],
]

const ENGINE_SUFFIX_VARIANTS = [
  ['validate: pass on first attempt', 'Task [✓]', 'Task'],
  ['validate: pass after retry', 'Task [✓ retry-2]', 'Task'],
  ['validate: all retries exhausted', 'Task [✗ 3 attempts]', 'Task'],
  ['refine: all forks eligible', 'Task [✓ 3/3]', 'Task'],
  ['refine: some forks eligible', 'Task [✓ 2/3]', 'Task'],
  ['refine: no forks eligible', 'Task [✗ 0/3]', 'Task'],
  ['refine: all jurors excluded', 'Task [⚠ no judge signal]', 'Task'],
  ['refine: fallback commit', 'Task [⚠ fallback: 0/3 passed; chose fork-1]', 'Task'],
  ['invalid empty criterion', 'Task [✗ invalid]', 'Task'],
]

const ALL_SUFFIX_VARIANTS = [...LEGACY_SUFFIX_VARIANTS, ...ENGINE_SUFFIX_VARIANTS]

// ─── stripReliabilitySuffix ───────────────────────────────────────────────────

describe('stripReliabilitySuffix', () => {
  describe('null and undefined input → empty string', () => {
    it.each([null, undefined])('returns "" for %p', input => {
      expect(stripReliabilitySuffix(input)).toBe('')
    })
  })

  describe('strips each legacy suffix variant', () => {
    it.each(LEGACY_SUFFIX_VARIANTS)('%s', (_, input, expected) => {
      expect(stripReliabilitySuffix(input)).toBe(expected)
    })
  })

  describe('strips each current engine suffix variant', () => {
    it.each(ENGINE_SUFFIX_VARIANTS)('%s', (_, input, expected) => {
      expect(stripReliabilitySuffix(input)).toBe(expected)
    })
  })

  describe('idempotent — strip applied twice equals strip applied once', () => {
    it.each(ALL_SUFFIX_VARIANTS)('%s', (_, input, expected) => {
      expect(stripReliabilitySuffix(stripReliabilitySuffix(input))).toBe(expected)
    })
  })

  describe('strips only the trailing suffix', () => {
    it('leaves earlier user brackets intact when followed by a legacy suffix', () => {
      expect(stripReliabilitySuffix('report [Q1] [✓ 3/3 best of 3]')).toBe('report [Q1]')
    })

    it('leaves earlier user brackets intact when followed by an engine suffix', () => {
      expect(stripReliabilitySuffix('report [Q1] [✓ retry-1]')).toBe('report [Q1]')
    })

    it('reduces a legacy-suffix-only title to an empty string', () => {
      expect(stripReliabilitySuffix('[✓ refined]')).toBe('')
    })

    it('reduces an engine-suffix-only title to an empty string', () => {
      expect(stripReliabilitySuffix('[✓]')).toBe('')
    })
  })

  describe('leaves non-suffix content unchanged', () => {
    it('empty string', () => {
      expect(stripReliabilitySuffix('')).toBe('')
    })

    it('plain title with no brackets', () => {
      expect(stripReliabilitySuffix('Normal task')).toBe('Normal task')
    })

    it('user brackets that do not match any reliability suffix pattern', () => {
      expect(stripReliabilitySuffix('Task [with brackets]')).toBe('Task [with brackets]')
    })

    it('brackets appearing in the middle of the title are not trailing and are preserved', () => {
      expect(stripReliabilitySuffix('[topic] analysis')).toBe('[topic] analysis')
    })

    describe('user brackets starting with a reliability symbol but not matching a known suffix shape are preserved', () => {
      it.each([
        ['✓ freeform text', 'Report [✓ approved by manager]', 'Report [✓ approved by manager]'],
        ['✗ freeform text', 'My analysis [✗ invalid output]', 'My analysis [✗ invalid output]'],
        ['⚠ freeform text', 'My note [⚠ needs attention]', 'My note [⚠ needs attention]'],
        ['bare ✗ (no content after symbol)', 'Task [✗]', 'Task [✗]'],
        ['✓ retry- with no trailing digit', 'Task [✓ retry-]', 'Task [✓ retry-]'],
        ['✗ lone number without "attempts"', 'Task [✗ 3]', 'Task [✗ 3]'],
        [
          '⚠ fallback: non-zero eligible count',
          'Task [⚠ fallback: 1/3 passed; chose fork-0]',
          'Task [⚠ fallback: 1/3 passed; chose fork-0]',
        ],
      ])('[%s]', (_, input, expected) => {
        expect(stripReliabilitySuffix(input)).toBe(expected)
      })
    })
  })
})

// ─── appendValidateSuffix ─────────────────────────────────────────────────────

describe('appendValidateSuffix', () => {
  describe('[✓] — pass on first attempt', () => {
    it('retryCount=0 → [✓]', () => {
      expect(appendValidateSuffix('My task', {passed: true, retryCount: 0})).toBe('My task [✓]')
    })
  })

  describe('[✓ retry-K] — pass after one or more retries', () => {
    it.each([
      [1, 'My task [✓ retry-1]'],
      [2, 'My task [✓ retry-2]'],
      [5, 'My task [✓ retry-5]'],
    ])('retryCount=%i → %s', (retryCount, expected) => {
      expect(appendValidateSuffix('My task', {passed: true, retryCount})).toBe(expected)
    })
  })

  describe('[✗ N attempts] — all retries exhausted', () => {
    it.each([
      [0, 'My task [✗ 0 attempts]'],
      [1, 'My task [✗ 1 attempts]'],
      [3, 'My task [✗ 3 attempts]'],
    ])('retryCount=%i → %s', (retryCount, expected) => {
      expect(appendValidateSuffix('My task', {passed: false, retryCount})).toBe(expected)
    })
  })

  describe('strips pre-existing reliability suffix before appending — no stacking across all known shapes', () => {
    it.each(ALL_SUFFIX_VARIANTS)('%s — replaced by [✓]', (_, titleWithSuffix, base) => {
      expect(appendValidateSuffix(titleWithSuffix, {passed: true, retryCount: 0})).toBe(`${base} [✓]`)
    })
  })

  describe('title clamping to 80-character maximum', () => {
    it.each([
      [{passed: true, retryCount: 0}, '[✓]'],
      [{passed: true, retryCount: 2}, '[✓ retry-2]'],
      [{passed: false, retryCount: 3}, '[✗ 3 attempts]'],
    ])('%o — result stays within 80 chars and contains correct suffix', (opts, expectedSuffix) => {
      const longTitle = 'A'.repeat(75)
      const result = appendValidateSuffix(longTitle, opts)
      expect(result.length).toBeLessThanOrEqual(80)
      expect(result).toContain(expectedSuffix)
    })
  })

  it('empty title → suffix only', () => {
    expect(appendValidateSuffix('', {passed: true, retryCount: 0})).toBe('[✓]')
  })
})

// ─── appendRefineSuffix ───────────────────────────────────────────────────────

describe('appendRefineSuffix', () => {
  describe('[✓ K/N] — one or more forks eligible', () => {
    it.each([
      [{eligible: 3, total: 3}, '[✓ 3/3]'],
      [{eligible: 2, total: 3}, '[✓ 2/3]'],
      [{eligible: 1, total: 3}, '[✓ 1/3]'],
      [{eligible: 1, total: 2}, '[✓ 1/2]'],
    ])('%o → %s', (opts, expected) => {
      expect(appendRefineSuffix('Task', opts)).toBe(`Task ${expected}`)
    })
  })

  describe('[✗ 0/N] — strict-mode: no eligible forks', () => {
    it.each([
      [{eligible: 0, total: 2}, '[✗ 0/2]'],
      [{eligible: 0, total: 3}, '[✗ 0/3]'],
      [{eligible: 0, total: 5}, '[✗ 0/5]'],
    ])('%o → %s', (opts, expected) => {
      expect(appendRefineSuffix('Task', opts)).toBe(`Task ${expected}`)
    })
  })

  describe('[✗ 0/N] — fallback flag set but winnerForkIndex is null', () => {
    it('falls through to strict-failure suffix when no winner found despite :fallback', () => {
      expect(appendRefineSuffix('Task', {eligible: 0, total: 3, fallback: true, winnerForkIndex: null})).toBe(
        'Task [✗ 0/3]',
      )
    })
  })

  describe('[⚠ fallback: 0/N passed; chose fork-K] — opt-in degraded commit', () => {
    it.each([
      [{eligible: 0, total: 3, fallback: true, winnerForkIndex: 1}, '[⚠ fallback: 0/3 passed; chose fork-1]'],
      [{eligible: 0, total: 2, fallback: true, winnerForkIndex: 0}, '[⚠ fallback: 0/2 passed; chose fork-0]'],
      [{eligible: 0, total: 5, fallback: true, winnerForkIndex: 3}, '[⚠ fallback: 0/5 passed; chose fork-3]'],
    ])('%o → %s', (opts, expected) => {
      expect(appendRefineSuffix('Task', opts)).toBe(`Task ${expected}`)
    })
  })

  describe('[⚠ no judge signal] — all jurors excluded from quorum', () => {
    it('noSignal:true → [⚠ no judge signal]', () => {
      expect(appendRefineSuffix('Task', {eligible: 2, total: 2, noSignal: true})).toBe('Task [⚠ no judge signal]')
    })

    it('noSignal:true takes priority over fallback, eligible, and total', () => {
      expect(
        appendRefineSuffix('Task', {eligible: 0, total: 3, fallback: true, winnerForkIndex: 1, noSignal: true}),
      ).toBe('Task [⚠ no judge signal]')
    })
  })

  describe('strips pre-existing reliability suffix before appending — no stacking across all known shapes', () => {
    it.each(ALL_SUFFIX_VARIANTS)('%s — replaced by [✓ 3/3]', (_, titleWithSuffix, base) => {
      expect(appendRefineSuffix(titleWithSuffix, {eligible: 3, total: 3})).toBe(`${base} [✓ 3/3]`)
    })
  })

  describe('title clamping to 80-character maximum', () => {
    it.each([
      [{eligible: 3, total: 3}, '[✓ 3/3]'],
      [{eligible: 0, total: 3}, '[✗ 0/3]'],
      [{eligible: 0, total: 3, noSignal: true}, '[⚠ no judge signal]'],
    ])('%o — result stays within 80 chars and contains correct suffix', (opts, expectedSuffix) => {
      const longTitle = 'A'.repeat(75)
      const result = appendRefineSuffix(longTitle, opts)
      expect(result.length).toBeLessThanOrEqual(80)
      expect(result).toContain(expectedSuffix)
    })
  })

  it('empty title → suffix only', () => {
    expect(appendRefineSuffix('', {eligible: 3, total: 3})).toBe('[✓ 3/3]')
  })
})

describe('appendCommoditySuffix', () => {
  describe('[✓ K/N] — at least one fork produced output', () => {
    it.each([
      [{successCount: 2, total: 2}, 'Task [✓ 2/2]'],
      [{successCount: 5, total: 5}, 'Task [✓ 5/5]'],
      [{successCount: 1, total: 3}, 'Task [✓ 1/3]'],
      [{successCount: 2, total: 5}, 'Task [✓ 2/5]'],
    ])('%o → %s', (opts, expected) => {
      expect(appendCommoditySuffix('Task', opts)).toBe(expected)
    })
  })

  describe('[✗ 0/N] — no fork produced output', () => {
    it.each([
      [{successCount: 0, total: 2}, 'Task [✗ 0/2]'],
      [{successCount: 0, total: 5}, 'Task [✗ 0/5]'],
    ])('%o → %s', (opts, expected) => {
      expect(appendCommoditySuffix('Task', opts)).toBe(expected)
    })
  })

  describe('strips pre-existing reliability suffix before appending — no stacking across all known shapes', () => {
    it.each(ALL_SUFFIX_VARIANTS)('%s — replaced by [✓ 2/2]', (_, titleWithSuffix, base) => {
      expect(appendCommoditySuffix(titleWithSuffix, {successCount: 2, total: 2})).toBe(`${base} [✓ 2/2]`)
    })
  })

  describe('title clamping to 80-character maximum', () => {
    it.each([
      [{successCount: 2, total: 2}, '[✓ 2/2]'],
      [{successCount: 0, total: 2}, '[✗ 0/2]'],
    ])('%o — result stays within 80 chars and contains correct suffix', (opts, expectedSuffix) => {
      const longTitle = 'A'.repeat(75)
      const result = appendCommoditySuffix(longTitle, opts)
      expect(result.length).toBeLessThanOrEqual(80)
      expect(result).toContain(expectedSuffix)
    })
  })

  it('empty title → suffix only', () => {
    expect(appendCommoditySuffix('', {successCount: 2, total: 2})).toBe('[✓ 2/2]')
  })
})

describe('appendInvalidSuffix', () => {
  it('writes [✗ invalid] on the cell title', () => {
    expect(appendInvalidSuffix('My validate')).toBe('My validate [✗ invalid]')
  })

  it('result is strippable by stripReliabilitySuffix', () => {
    const titled = appendInvalidSuffix('My validate')
    expect(stripReliabilitySuffix(titled)).toBe('My validate')
  })

  describe('strips pre-existing reliability suffix before appending — no stacking across all known shapes', () => {
    it.each(ALL_SUFFIX_VARIANTS)('%s — replaced by [✗ invalid]', (_, titleWithSuffix, base) => {
      expect(appendInvalidSuffix(titleWithSuffix)).toBe(`${base} [✗ invalid]`)
    })
  })

  it('clamps result to 80-character maximum', () => {
    const longTitle = 'A'.repeat(75)
    const result = appendInvalidSuffix(longTitle)
    expect(result.length).toBeLessThanOrEqual(80)
    expect(result).toContain('[✗ invalid]')
  })

  it('empty title → suffix only', () => {
    expect(appendInvalidSuffix('')).toBe('[✗ invalid]')
  })
})

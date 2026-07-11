import { describe, it, expect } from 'vitest'
import { stripReliabilitySuffix, isTitleDerivedFromCommand, deriveNodeTitle } from '../reliability-suffix'

const LEGACY_SUFFIX_VARIANTS = [
  ['bestOfN success', '/chat list [✓ 2/2 best of 2]', '/chat list'],
  ['bestOfN with confidence score', '/chat list [✓ 3/3 best of 3 · 0.92]', '/chat list'],
  ['bestOfN gate failure', '/chat list [✗ 0/2 passed]', '/chat list'],
  ['first-survivor without judge', '/chat list [✓ 2/2 first-survivor · no judge]', '/chat list'],
  ['first-survivor with judge error', '/chat list [✓ 1/2 first-survivor · judge auth error]', '/chat list'],
  ['refined', '/chat list [✓ refined]', '/chat list'],
  ['refine failed', '/chat list [✗ refine failed]', '/chat list'],
] as const satisfies ReadonlyArray<[string, string, string]>

const ENGINE_SUFFIX_VARIANTS = [
  ['validate passed no retry', '/chat list [✓]', '/chat list'],
  ['validate passed after retry', '/chat list [✓ retry-2]', '/chat list'],
  ['validate failed all attempts', '/chat list [✗ 3 attempts]', '/chat list'],
  ['refine all eligible', '/chat list [✓ 3/3]', '/chat list'],
  ['refine some eligible', '/chat list [✓ 2/3]', '/chat list'],
  ['refine none eligible', '/chat list [✗ 0/3]', '/chat list'],
  ['refine no judge signal', '/chat list [⚠ no judge signal]', '/chat list'],
  ['refine fallback with winner', '/chat list [⚠ fallback: 0/3 passed; chose fork-1]', '/chat list'],
] as const satisfies ReadonlyArray<[string, string, string]>

const ALL_SUFFIX_VARIANTS = [...LEGACY_SUFFIX_VARIANTS, ...ENGINE_SUFFIX_VARIANTS]

describe('stripReliabilitySuffix', () => {
  describe('strips each legacy reliability suffix variant', () => {
    it.each(LEGACY_SUFFIX_VARIANTS)('%s', (_label, titleWithSuffix, baseTitle) => {
      expect(stripReliabilitySuffix(titleWithSuffix)).toBe(baseTitle)
    })
  })

  describe('strips each current engine suffix variant', () => {
    it.each(ENGINE_SUFFIX_VARIANTS)('%s', (_label, titleWithSuffix, baseTitle) => {
      expect(stripReliabilitySuffix(titleWithSuffix)).toBe(baseTitle)
    })
  })

  describe('idempotent — strip applied twice equals strip applied once', () => {
    it.each(ALL_SUFFIX_VARIANTS)('%s', (_label, titleWithSuffix, baseTitle) => {
      expect(stripReliabilitySuffix(stripReliabilitySuffix(titleWithSuffix))).toBe(baseTitle)
    })
  })

  describe('strips only the trailing suffix', () => {
    it('leaves earlier user brackets intact when followed by a legacy suffix', () => {
      expect(stripReliabilitySuffix('report [Q1] [✓ 2/2 best of 2]')).toBe('report [Q1]')
    })

    it('leaves earlier user brackets intact when followed by an engine suffix', () => {
      expect(stripReliabilitySuffix('report [Q1] [✓ retry-1]')).toBe('report [Q1]')
    })

    it('reduces a suffix-only title to an empty string', () => {
      expect(stripReliabilitySuffix('[✓ refined]')).toBe('')
    })
  })

  describe('leaves non-suffix content unchanged', () => {
    it('plain title with no brackets', () => {
      expect(stripReliabilitySuffix('/chat list 3 colors')).toBe('/chat list 3 colors')
    })

    it('user brackets that do not match the reliability suffix pattern', () => {
      expect(stripReliabilitySuffix('analyse competitors [important]')).toBe('analyse competitors [important]')
    })

    describe('user brackets starting with a reliability symbol but not matching a known suffix shape are preserved', () => {
      it.each([
        ['✓ with freeform text', 'My report [✓ approved by manager]', 'My report [✓ approved by manager]'],
        ['✗ with freeform text', 'My analysis [✗ invalid output]', 'My analysis [✗ invalid output]'],
        ['⚠ with freeform text', 'My note [⚠ needs attention]', 'My note [⚠ needs attention]'],
        ['✓ retry- with no trailing digit', 'Task [✓ retry-]', 'Task [✓ retry-]'],
        ['✗ lone number without "attempts"', 'Task [✗ 3]', 'Task [✗ 3]'],
        [
          '⚠ fallback with non-zero eligible count',
          'Task [⚠ fallback: 1/3 passed; chose fork-0]',
          'Task [⚠ fallback: 1/3 passed; chose fork-0]',
        ],
      ] as const satisfies ReadonlyArray<[string, string, string]>)('%s', (_label, titleWithBrackets, expected) => {
        expect(stripReliabilitySuffix(titleWithBrackets)).toBe(expected)
      })
    })

    it('brackets appearing in the middle of the title', () => {
      expect(stripReliabilitySuffix('[topic] analysis')).toBe('[topic] analysis')
    })

    it('empty string', () => {
      expect(stripReliabilitySuffix('')).toBe('')
    })
  })
})

describe('isTitleDerivedFromCommand', () => {
  describe('returns true', () => {
    it('title exactly equals command with no suffix', () => {
      expect(isTitleDerivedFromCommand('/chat list colors', '/chat list colors')).toBe(true)
    })

    it.each(ALL_SUFFIX_VARIANTS)('title is command plus %s suffix', (_label, titleWithSuffix, command) => {
      expect(isTitleDerivedFromCommand(titleWithSuffix, command)).toBe(true)
    })

    it('both title and command are empty strings', () => {
      expect(isTitleDerivedFromCommand('', '')).toBe(true)
    })
  })

  describe('returns false', () => {
    it('user-authored text with no suffix that differs from command', () => {
      expect(isTitleDerivedFromCommand('My analysis', '/chat analyse')).toBe(false)
    })

    it('user-authored text with a reliability suffix that differs from command', () => {
      expect(isTitleDerivedFromCommand('My analysis [✓ 2/2 best of 2]', '/chat analyse')).toBe(false)
    })

    it('empty title with a non-empty command', () => {
      expect(isTitleDerivedFromCommand('', '/chat list')).toBe(false)
    })

    it('non-empty title with an empty command', () => {
      expect(isTitleDerivedFromCommand('/chat list', '')).toBe(false)
    })
  })
})

describe('deriveNodeTitle', () => {
  describe('returns nextCommand when title is command-derived or absent', () => {
    it('title is absent (undefined)', () => {
      expect(deriveNodeTitle({ title: undefined, command: '/chat list' }, '/chat new')).toBe('/chat new')
    })

    it('title is an empty string', () => {
      expect(deriveNodeTitle({ title: '', command: '/chat list' }, '/chat new')).toBe('/chat new')
    })

    it('both title and command are absent', () => {
      expect(deriveNodeTitle({ title: undefined, command: undefined }, '/chat new')).toBe('/chat new')
    })

    it('title exactly equals command', () => {
      expect(deriveNodeTitle({ title: '/chat list', command: '/chat list' }, '/chat new')).toBe('/chat new')
    })

    it.each(ALL_SUFFIX_VARIANTS)('title is command plus %s suffix', (_label, titleWithSuffix, command) => {
      expect(deriveNodeTitle({ title: titleWithSuffix, command }, '/chat new')).toBe('/chat new')
    })
  })

  describe('returns stripped user title when title is user-authored', () => {
    it('user title without a suffix', () => {
      expect(deriveNodeTitle({ title: 'My analysis', command: '/chat analyse' }, '/chat new')).toBe('My analysis')
    })

    it('user title with a legacy reliability suffix', () => {
      expect(deriveNodeTitle({ title: 'My analysis [✓ 2/2 best of 2]', command: '/chat analyse' }, '/chat new')).toBe(
        'My analysis',
      )
    })

    it('user title with an engine suffix', () => {
      expect(deriveNodeTitle({ title: 'My analysis [✓ retry-1]', command: '/chat analyse' }, '/chat new')).toBe(
        'My analysis',
      )
    })

    it('command is absent', () => {
      expect(deriveNodeTitle({ title: 'My analysis', command: undefined }, '/chat new')).toBe('My analysis')
    })
  })
})

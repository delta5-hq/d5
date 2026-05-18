import { describe, it, expect } from 'vitest'
import { stripReliabilitySuffix, isTitleDerivedFromCommand, deriveNodeTitle } from '../reliability-suffix'

const SUFFIX_VARIANTS = [
  ['bestOfN success', '/chat list [✓ 2/2 best of 2]', '/chat list'],
  ['bestOfN with confidence score', '/chat list [✓ 3/3 best of 3 · 0.92]', '/chat list'],
  ['bestOfN gate failure', '/chat list [✗ 0/2 passed]', '/chat list'],
  ['first-survivor without judge', '/chat list [✓ 2/2 first-survivor · no judge]', '/chat list'],
  ['first-survivor with judge error', '/chat list [✓ 1/2 first-survivor · judge auth error]', '/chat list'],
  ['refined', '/chat list [✓ refined]', '/chat list'],
  ['refine failed', '/chat list [✗ refine failed]', '/chat list'],
] as const satisfies ReadonlyArray<[string, string, string]>

describe('stripReliabilitySuffix', () => {
  describe('strips each reliability suffix variant', () => {
    it.each(SUFFIX_VARIANTS)('%s', (_label, titleWithSuffix, baseTitle) => {
      expect(stripReliabilitySuffix(titleWithSuffix)).toBe(baseTitle)
    })
  })

  describe('strips only the trailing suffix', () => {
    it('leaves earlier user brackets intact when followed by a suffix', () => {
      expect(stripReliabilitySuffix('report [Q1] [✓ 2/2 best of 2]')).toBe('report [Q1]')
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

    it.each(SUFFIX_VARIANTS)('title is command plus %s suffix', (_label, titleWithSuffix, command) => {
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

    it.each(SUFFIX_VARIANTS)('title is command plus %s suffix', (_label, titleWithSuffix, command) => {
      expect(deriveNodeTitle({ title: titleWithSuffix, command }, '/chat new')).toBe('/chat new')
    })
  })

  describe('returns stripped user title when title is user-authored', () => {
    it('user title without a suffix', () => {
      expect(deriveNodeTitle({ title: 'My analysis', command: '/chat analyse' }, '/chat new')).toBe('My analysis')
    })

    it('user title with a reliability suffix', () => {
      expect(deriveNodeTitle({ title: 'My analysis [✓ 2/2 best of 2]', command: '/chat analyse' }, '/chat new')).toBe(
        'My analysis',
      )
    })

    it('command is absent', () => {
      expect(deriveNodeTitle({ title: 'My analysis', command: undefined }, '/chat new')).toBe('My analysis')
    })
  })
})

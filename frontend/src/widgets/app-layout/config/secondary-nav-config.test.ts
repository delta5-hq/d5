import { describe, it, expect } from 'vitest'
import { SECTION_MENUS, getSectionGroupLabel, isMenuItemActive, type SectionId } from './secondary-nav-config'

describe('isMenuItemActive', () => {
  describe('exact match', () => {
    it('returns true when path equals item URL', () => {
      expect(isMenuItemActive('/workflows', '/workflows')).toBe(true)
    })

    it('returns true for root-level paths', () => {
      expect(isMenuItemActive('/register', '/register')).toBe(true)
    })

    it('returns true for nested paths', () => {
      expect(isMenuItemActive('/admin/waitlist', '/admin/waitlist')).toBe(true)
    })
  })

  describe('prefix match', () => {
    it('matches child routes under item URL', () => {
      expect(isMenuItemActive('/workflows', '/workflows/123')).toBe(true)
    })

    it('matches deeply nested routes', () => {
      expect(isMenuItemActive('/admin/users', '/admin/users/abc/edit')).toBe(true)
    })

    it('requires path separator after prefix', () => {
      expect(isMenuItemActive('/admin', '/admin-panel')).toBe(false)
    })

    it('does not match partial directory names', () => {
      expect(isMenuItemActive('/templates', '/templates2')).toBe(false)
    })
  })

  describe('non-match', () => {
    it('returns false for unrelated paths', () => {
      expect(isMenuItemActive('/workflows', '/settings')).toBe(false)
    })

    it('returns false when item URL is substring but not prefix', () => {
      expect(isMenuItemActive('/admin/users', '/admin')).toBe(false)
    })

    it('returns false for empty current path', () => {
      expect(isMenuItemActive('/workflows', '')).toBe(false)
    })
  })
})

describe('getSectionGroupLabel', () => {
  const knownSections: Array<{ section: SectionId; expected: string }> = [
    { section: 'home', expected: 'sidebarHomeLabel' },
    { section: 'create', expected: 'sidebarCreateLabel' },
    { section: 'public', expected: 'sidebarPublicLabel' },
    { section: 'settings', expected: 'sidebarSettingsLabel' },
    { section: 'admin', expected: 'sidebarAdminLabel' },
    { section: 'training', expected: 'menuItemTraining' },
    { section: 'landing', expected: 'sidebarWelcomeLabel' },
  ]

  knownSections.forEach(({ section, expected }) => {
    it(`returns '${expected}' for '${section}' section`, () => {
      expect(getSectionGroupLabel(section)).toBe(expected)
    })
  })

  it('returns default label for unknown section', () => {
    expect(getSectionGroupLabel('unknown')).toBe('sidebarMainGroupLabel')
  })

  it('returns default label for empty string', () => {
    expect(getSectionGroupLabel('')).toBe('sidebarMainGroupLabel')
  })
})

describe('SECTION_MENUS structure', () => {
  it('defines entries for all SectionId values', () => {
    const expectedIds: SectionId[] = ['create', 'home', 'public', 'settings', 'admin', 'training', 'landing']
    expect(Object.keys(SECTION_MENUS).sort()).toEqual(expectedIds.sort())
  })

  it('contains no duplicate URLs within a section', () => {
    for (const [sectionId, items] of Object.entries(SECTION_MENUS)) {
      const urls = items.map(i => i.url).filter(u => u !== '#')
      const unique = new Set(urls)
      expect(unique.size, `duplicate URLs in section '${sectionId}'`).toBe(urls.length)
    }
  })

  it('every navigable item has a URL starting with /', () => {
    for (const items of Object.values(SECTION_MENUS)) {
      for (const item of items) {
        if (item.url !== '#') {
          expect(item.url.startsWith('/'), `URL '${item.url}' must start with /`).toBe(true)
        }
      }
    }
  })

  it('action items use url "#" and define an action type', () => {
    for (const items of Object.values(SECTION_MENUS)) {
      for (const item of items) {
        if (item.action === 'dialog') {
          expect(item.url).toBe('#')
          expect(item.dialog).toBeDefined()
        }
      }
    }
  })
})

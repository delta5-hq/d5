import { describe, it, expect } from 'vitest'
import { isNavItemActive, filterVisibleNavItems, PRIMARY_NAV_ITEMS, type NavItem } from './primary-nav-config'

function navItem(overrides: Partial<NavItem> & { id: string; url: string }): NavItem {
  return {
    titleId: `label_${overrides.id}`,
    icon: () => null,
    ...overrides,
  }
}

describe('isNavItemActive', () => {
  describe('exact URL match', () => {
    it('matches when currentPath equals item URL', () => {
      expect(isNavItemActive(navItem({ id: 'settings', url: '/settings' }), '/settings')).toBe(true)
    })

    it('matches root URL at exact /', () => {
      expect(isNavItemActive(navItem({ id: 'home', url: '/' }), '/')).toBe(true)
    })

    it('matches nested URL exactly', () => {
      expect(isNavItemActive(navItem({ id: 'public', url: '/workflows/public' }), '/workflows/public')).toBe(true)
    })
  })

  describe('prefix match (non-root items)', () => {
    it('matches child routes under item URL', () => {
      expect(isNavItemActive(navItem({ id: 'settings', url: '/settings' }), '/settings/profile')).toBe(true)
    })

    it('matches deeply nested child routes', () => {
      expect(isNavItemActive(navItem({ id: 'admin', url: '/admin' }), '/admin/users/abc/edit')).toBe(true)
    })

    it('requires path separator — no partial directory match', () => {
      expect(isNavItemActive(navItem({ id: 'settings', url: '/settings' }), '/settings2')).toBe(false)
    })

    it('does not prefix-match for root URL /', () => {
      expect(isNavItemActive(navItem({ id: 'home', url: '/' }), '/settings')).toBe(false)
    })

    it('does not prefix-match root URL against any nested path', () => {
      expect(isNavItemActive(navItem({ id: 'home', url: '/' }), '/admin/users')).toBe(false)
    })
  })

  describe('section menu child route resolution', () => {
    it('activates home via /workflows child route', () => {
      expect(isNavItemActive(navItem({ id: 'home', url: '/' }), '/workflows')).toBe(true)
    })

    it('activates home via /templates child route', () => {
      expect(isNavItemActive(navItem({ id: 'home', url: '/' }), '/templates')).toBe(true)
    })

    it('activates home via nested workflow path', () => {
      expect(isNavItemActive(navItem({ id: 'home', url: '/' }), '/workflows/abc-123')).toBe(true)
    })

    it('activates home via deeply nested template path', () => {
      expect(isNavItemActive(navItem({ id: 'home', url: '/' }), '/templates/category/sub')).toBe(true)
    })

    it('activates admin via /admin/waitlist child route', () => {
      expect(isNavItemActive(navItem({ id: 'admin', url: '/admin' }), '/admin/waitlist')).toBe(true)
    })

    it('activates admin via /admin/users child route', () => {
      expect(isNavItemActive(navItem({ id: 'admin', url: '/admin' }), '/admin/users')).toBe(true)
    })

    it('skips section menu items with url "#"', () => {
      expect(isNavItemActive(navItem({ id: 'landing', url: '/' }), '#')).toBe(false)
    })

    it('activates landing via /register child route', () => {
      expect(isNavItemActive(navItem({ id: 'landing', url: '/' }), '/register')).toBe(true)
    })
  })

  describe('empty section menus', () => {
    it('returns false for item with empty section menu and no URL match', () => {
      expect(isNavItemActive(navItem({ id: 'create', url: '#' }), '/workflows')).toBe(false)
    })

    it('returns false for public section on unrelated path', () => {
      expect(isNavItemActive(navItem({ id: 'public', url: '/workflows/public' }), '/settings')).toBe(false)
    })

    it('returns false for training section on unrelated path', () => {
      expect(isNavItemActive(navItem({ id: 'training', url: '/training' }), '/settings')).toBe(false)
    })
  })

  describe('unknown section IDs', () => {
    it('falls through to false for id with no section menu entry', () => {
      expect(isNavItemActive(navItem({ id: 'nonexistent', url: '/nope' }), '/workflows')).toBe(false)
    })
  })

  describe('no false positives across sections', () => {
    const sections = PRIMARY_NAV_ITEMS

    it('only one section activates for /workflows', () => {
      const active = sections.filter(item => isNavItemActive(item, '/workflows'))
      const activeIds = active.map(i => i.id)
      expect(activeIds).toContain('home')
      expect(activeIds).not.toContain('admin')
      expect(activeIds).not.toContain('settings')
      expect(activeIds).not.toContain('public')
    })

    it('only one section activates for /admin/users/x', () => {
      const active = sections.filter(item => isNavItemActive(item, '/admin/users/x'))
      const activeIds = active.map(i => i.id)
      expect(activeIds).toContain('admin')
      expect(activeIds).not.toContain('home')
      expect(activeIds).not.toContain('settings')
    })

    it('only one section activates for /settings/profile', () => {
      const active = sections.filter(item => isNavItemActive(item, '/settings/profile'))
      const activeIds = active.map(i => i.id)
      expect(activeIds).toContain('settings')
      expect(activeIds).not.toContain('home')
      expect(activeIds).not.toContain('admin')
    })

    it('root path / activates only home and landing', () => {
      const active = sections.filter(item => isNavItemActive(item, '/'))
      const activeIds = active.map(i => i.id)
      expect(activeIds).toContain('home')
      expect(activeIds).toContain('landing')
      expect(activeIds).not.toContain('admin')
      expect(activeIds).not.toContain('settings')
      expect(activeIds).not.toContain('public')
    })
  })
})

describe('filterVisibleNavItems', () => {
  const items: NavItem[] = [
    navItem({ id: 'public', url: '/workflows/public' }),
    navItem({ id: 'home', url: '/', requiresAuth: true }),
    navItem({ id: 'landing', url: '/', requiresGuest: true }),
    navItem({ id: 'settings', url: '/settings', requiresAuth: true }),
    navItem({ id: 'admin', url: '/admin', requiresAdmin: true }),
  ]

  describe('unauthenticated user', () => {
    it('shows public and guest items', () => {
      const result = filterVisibleNavItems(items, false, false)
      const ids = result.map(i => i.id)
      expect(ids).toContain('public')
      expect(ids).toContain('landing')
    })

    it('hides auth-required items', () => {
      const result = filterVisibleNavItems(items, false, false)
      const ids = result.map(i => i.id)
      expect(ids).not.toContain('home')
      expect(ids).not.toContain('settings')
    })

    it('hides admin items', () => {
      const result = filterVisibleNavItems(items, false, false)
      const ids = result.map(i => i.id)
      expect(ids).not.toContain('admin')
    })
  })

  describe('authenticated non-admin user', () => {
    it('shows public and auth items', () => {
      const result = filterVisibleNavItems(items, true, false)
      const ids = result.map(i => i.id)
      expect(ids).toContain('public')
      expect(ids).toContain('home')
      expect(ids).toContain('settings')
    })

    it('hides guest items', () => {
      const result = filterVisibleNavItems(items, true, false)
      const ids = result.map(i => i.id)
      expect(ids).not.toContain('landing')
    })

    it('hides admin items', () => {
      const result = filterVisibleNavItems(items, true, false)
      const ids = result.map(i => i.id)
      expect(ids).not.toContain('admin')
    })
  })

  describe('admin user', () => {
    it('shows admin items', () => {
      const result = filterVisibleNavItems(items, true, true)
      const ids = result.map(i => i.id)
      expect(ids).toContain('admin')
    })

    it('shows auth and public items', () => {
      const result = filterVisibleNavItems(items, true, true)
      const ids = result.map(i => i.id)
      expect(ids).toContain('public')
      expect(ids).toContain('home')
      expect(ids).toContain('settings')
    })

    it('hides guest items', () => {
      const result = filterVisibleNavItems(items, true, true)
      const ids = result.map(i => i.id)
      expect(ids).not.toContain('landing')
    })
  })

  describe('edge cases', () => {
    it('returns empty array when no items match', () => {
      const adminOnly = [navItem({ id: 'admin', url: '/admin', requiresAdmin: true })]
      expect(filterVisibleNavItems(adminOnly, false, false)).toEqual([])
    })

    it('returns all items when none have restrictions', () => {
      const unrestricted = [navItem({ id: 'a', url: '/a' }), navItem({ id: 'b', url: '/b' })]
      expect(filterVisibleNavItems(unrestricted, false, false)).toHaveLength(2)
      expect(filterVisibleNavItems(unrestricted, true, true)).toHaveLength(2)
    })

    it('handles empty input array', () => {
      expect(filterVisibleNavItems([], true, true)).toEqual([])
    })

    it('preserves input order', () => {
      const result = filterVisibleNavItems(items, true, true)
      const ids = result.map(i => i.id)
      expect(ids.indexOf('public')).toBeLessThan(ids.indexOf('home'))
      expect(ids.indexOf('home')).toBeLessThan(ids.indexOf('settings'))
      expect(ids.indexOf('settings')).toBeLessThan(ids.indexOf('admin'))
    })
  })
})

describe('PRIMARY_NAV_ITEMS structure', () => {
  it('contains no duplicate ids', () => {
    const ids = PRIMARY_NAV_ITEMS.map(i => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every item has a non-empty titleId', () => {
    for (const item of PRIMARY_NAV_ITEMS) {
      expect(item.titleId.length).toBeGreaterThan(0)
    }
  })

  it('every item has an icon component', () => {
    for (const item of PRIMARY_NAV_ITEMS) {
      expect(item.icon).toBeDefined()
      expect(['function', 'object']).toContain(typeof item.icon)
    }
  })
})

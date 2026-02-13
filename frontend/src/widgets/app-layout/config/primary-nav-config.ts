import { type FC } from 'react'
import { BriefcaseBusiness, Globe, Home, Plus, School, Settings } from 'lucide-react'
import { SECTION_MENUS, isMenuItemActive, type SectionId } from './secondary-nav-config'

export interface NavItem {
  id: string
  titleId: string
  url: string
  icon: FC<{ className?: string }>
  requiresAuth?: boolean
  requiresAdmin?: boolean
  requiresGuest?: boolean
}

export const PRIMARY_NAV_ITEMS: ReadonlyArray<NavItem> = [
  { id: 'create', titleId: 'sidebarCreateLabel', url: '#', icon: Plus, requiresAuth: true },
  { id: 'home', titleId: 'sidebarHomeLabel', url: '/', icon: Home, requiresAuth: true },
  { id: 'landing', titleId: 'sidebarWelcomeLabel', url: '/', icon: Home, requiresGuest: true },
  { id: 'public', titleId: 'sidebarPublicLabel', url: '/workflows/public', icon: Globe },
  { id: 'training', titleId: 'menuItemTraining', url: '/training', icon: School, requiresAuth: true },
  { id: 'settings', titleId: 'sidebarSettingsLabel', url: '/settings', icon: Settings, requiresAuth: true },
  {
    id: 'admin',
    titleId: 'sidebarAdminLabel',
    url: '/admin',
    icon: BriefcaseBusiness,
    requiresAdmin: true,
  },
]

export function filterVisibleNavItems(items: ReadonlyArray<NavItem>, isLoggedIn: boolean, isAdmin: boolean): NavItem[] {
  return items.filter(item => {
    if (item.requiresAdmin) return isAdmin
    if (item.requiresAuth) return isLoggedIn
    if (item.requiresGuest) return !isLoggedIn
    return true
  })
}

export function isNavItemActive(item: NavItem, currentPath: string): boolean {
  if (currentPath === item.url) return true
  if (item.url !== '/' && currentPath.startsWith(item.url + '/')) return true

  const sectionMenuItems = SECTION_MENUS[item.id as SectionId]
  if (sectionMenuItems) {
    return sectionMenuItems.some(menuItem => menuItem.url !== '#' && isMenuItemActive(menuItem.url, currentPath))
  }

  return false
}

import { type FC } from 'react'
import { BriefcaseBusiness, Globe, Home, Plus, School, Settings } from 'lucide-react'

export interface NavItem {
  id: string
  titleId: string
  url: string
  icon: FC<{ className?: string }>
  requiresAuth?: boolean
  requiresAdmin?: boolean
}

export const PRIMARY_NAV_ITEMS: ReadonlyArray<NavItem> = [
  { id: 'create', titleId: 'sidebarCreateLabel', url: '#', icon: Plus, requiresAuth: true },
  { id: 'home', titleId: 'sidebarHomeLabel', url: '/', icon: Home },
  { id: 'public', titleId: 'sidebarPublicLabel', url: '/workflows/public', icon: Globe },
  { id: 'training', titleId: 'menuItemTraining', url: '/training', icon: School, requiresAuth: true },
  { id: 'settings', titleId: 'sidebarSettingsLabel', url: '/settings', icon: Settings, requiresAuth: true },
  {
    id: 'admin',
    titleId: 'sidebarAdminLabel',
    url: '/admin/users',
    icon: BriefcaseBusiness,
    requiresAdmin: true,
  },
]

export function filterVisibleNavItems(items: ReadonlyArray<NavItem>, isLoggedIn: boolean, isAdmin: boolean): NavItem[] {
  return items.filter(item => {
    if (item.requiresAdmin) return isAdmin
    if (item.requiresAuth) return isLoggedIn
    return true
  })
}

export function isNavItemActive(item: NavItem, currentPath: string): boolean {
  if (currentPath === item.url) return true
  if (item.url !== '/' && currentPath.startsWith(item.url + '/')) return true
  return false
}

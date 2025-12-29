import { type FC } from 'react'
import { BriefcaseBusiness, Settings, Workflow } from 'lucide-react'

export interface SecondaryMenuItem {
  titleId: string
  url: string
  icon?: FC<{ className?: string }>
  action?: 'create'
}

export type SectionId = 'create' | 'home' | 'public' | 'settings' | 'admin' | 'training'

export const SECTION_MENUS: Record<SectionId, ReadonlyArray<SecondaryMenuItem>> = {
  create: [],
  home: [{ titleId: 'sidebarMyWorkflowsLabel', url: '/workflows', icon: Workflow }],
  public: [],
  settings: [{ titleId: 'sidebarSettingsLabel', url: '/settings', icon: Settings }],
  admin: [
    { titleId: 'adminWaitlist', url: '/admin/waitlist', icon: BriefcaseBusiness },
    { titleId: 'adminList', url: '/admin/users', icon: BriefcaseBusiness },
  ],
  training: [],
}

export function getSectionGroupLabel(section: string): string {
  switch (section) {
    case 'home':
      return 'sidebarMyWorkflowsLabel'
    case 'create':
      return 'sidebarCreateLabel'
    case 'public':
      return 'sidebarPublicLabel'
    case 'settings':
      return 'sidebarSettingsLabel'
    case 'admin':
      return 'sidebarAdminLabel'
    case 'training':
      return 'menuItemTraining'
    default:
      return 'sidebarMainGroupLabel'
  }
}

export function isMenuItemActive(itemUrl: string, currentPath: string): boolean {
  return currentPath === itemUrl || currentPath.startsWith(itemUrl + '/')
}

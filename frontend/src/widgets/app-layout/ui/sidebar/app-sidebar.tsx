import { useAuthContext } from '@entities/auth'
import { cn } from '@shared/lib/utils'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@shared/ui/sidebar'
import { Version } from '@shared/ui/version'
import { BriefcaseBusiness, School, Settings, Workflow } from 'lucide-react'
import { useEffect, type FC } from 'react'
import { FormattedMessage } from 'react-intl'
import { Link, useLocation } from 'react-router-dom'
import { HelpButton, UserSettingsButton } from './../header'
import styles from './app-sidebar.module.scss'

interface AppSidebarProps {
  isResponsive?: boolean
  isDesktop?: boolean
  isMinimized?: boolean
}

const NAV_ITEMS = [{ titleId: 'sidebarPublicWorkflowsLabel', url: '/workflows/public', icon: Workflow }]

const ADMIN_ITEMS = [
  { titleId: 'adminWaitlist', url: '/admin/waitlist', icon: BriefcaseBusiness },
  { titleId: 'adminList', url: '/admin/users', icon: BriefcaseBusiness },
]

const LOGGED_IN_ITEMS = [
  { titleId: 'sidebarMyWorkflowsLabel', url: '/workflows', icon: Workflow },
  { titleId: 'sidebarSettingsLabel', url: '/settings', icon: Settings },
  { titleId: 'menuItemTraining', url: '/training', icon: School },
]

const AppSidebar: FC<AppSidebarProps> = ({ isResponsive, isDesktop, isMinimized }) => {
  const { isMobile, open, toggleSidebar } = useSidebar()
  const location = useLocation()
  const { isLoggedIn, isAdmin } = useAuthContext()

  useEffect(() => {
    if (!open && !isResponsive && isDesktop) toggleSidebar()
  }, [open, toggleSidebar, isResponsive, isDesktop])

  const allMenuUrls = [
    ...NAV_ITEMS.map(item => item.url),
    ...(isLoggedIn ? LOGGED_IN_ITEMS.map(item => item.url) : []),
    ...(isAdmin ? ADMIN_ITEMS.map(item => item.url) : []),
  ]

  const hasExactMatch = allMenuUrls.some(menuUrl => location.pathname === menuUrl)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderMenuItem = (url: string, titleId: string, Icon?: FC<any>) => {
    if (hasExactMatch) {
      const isActive = location.pathname === url
      return (
        <SidebarMenuItem className={cn(isActive && styles.menuLinkButton)} key={titleId}>
          <SidebarMenuButton asChild>
            <Link className="flex items-center gap-2" to={url}>
              {Icon ? <Icon className="w-5 h-5" /> : null}
              <span className={cn(isActive && styles.menuLinkText, 'text-sm')}>
                <FormattedMessage id={titleId} />
              </span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )
    }

    const isActive = location.pathname === url || location.pathname.startsWith(url + '/')
    return (
      <SidebarMenuItem className={cn(isActive && styles.menuLinkButton)} key={titleId}>
        <SidebarMenuButton asChild>
          <Link className="flex items-center gap-2" to={url}>
            {Icon ? <Icon className="w-5 h-5" /> : null}
            <span className={cn(isActive && styles.menuLinkText, 'text-sm')}>
              <FormattedMessage id={titleId} />
            </span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <Sidebar
      className={cn(isMobile ? 'mt-16 p-2 border-r border-sidebar-border' : 'pt-16', 'w-(--sidebar-width)')}
      collapsible={isMinimized ? 'icon' : 'offcanvas'}
      disableOverlay
      side={isMobile ? 'right' : 'left'}
      variant="sidebar"
    >
      {isMobile && isLoggedIn ? (
        <div className="flex flex-col gap-4 p-2">
          <div className="flex items-center gap-2">
            <HelpButton />
            <UserSettingsButton />
          </div>
        </div>
      ) : null}

      <SidebarContent className="flex flex-col justify-between p-2 pb-5">
        <SidebarGroup>
          <SidebarGroupLabel>
            <FormattedMessage id="sidebarMainGroupLabel" />
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(item => renderMenuItem(item.url, item.titleId, item.icon))}

              {isLoggedIn ? (
                <>
                  <hr className="my-2 border-border" />
                  {LOGGED_IN_ITEMS.map(item => renderMenuItem(item.url, item.titleId, item.icon))}
                </>
              ) : null}

              {isAdmin ? (
                <>
                  <hr className="my-2 border-border" />
                  {ADMIN_ITEMS.map(item => renderMenuItem(item.url, item.titleId, item.icon))}
                </>
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Version />
      </SidebarContent>
    </Sidebar>
  )
}

export default AppSidebar

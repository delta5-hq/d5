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
import { BriefcaseBusiness, School, Settings, Workflow } from 'lucide-react'
import { useEffect, type FC } from 'react'
import { FormattedMessage } from 'react-intl'
import { AppSearch, HelpButton, LoginButton, UserSettingsButton } from './../header'
import { useAuthContext } from '@entities/auth'
import { Link, useLocation } from 'react-router-dom'
import styles from './app-sidebar.module.scss'
import { useSearch } from '@shared/context'

interface AppSidebarProps {
  isResponsive?: boolean
  isDesktop?: boolean
  isMinimized?: boolean
  searchPlaceholder?: string
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

const AppSidebar: FC<AppSidebarProps> = ({ isResponsive, isDesktop, isMinimized, searchPlaceholder }) => {
  const { isMobile, open, toggleSidebar } = useSidebar()
  const location = useLocation()
  const { isLoggedIn, isAdmin } = useAuthContext()
  const { query, setQuery } = useSearch()

  useEffect(() => {
    if (!open && !isResponsive && isDesktop) toggleSidebar()
  }, [open, toggleSidebar, isResponsive, isDesktop])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderMenuItem = (url: string, titleId: string, Icon?: FC<any>) => {
    const isActive = location.pathname === url
    return (
      <SidebarMenuItem className={cn(isActive && styles.menuLinkButton)} key={titleId}>
        <SidebarMenuButton asChild>
          <Link className="flex items-center gap-2" to={url}>
            {Icon ? <Icon className="w-5 h-5" /> : null}
            <span className="text-sm">
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
      {isMobile ? (
        <div className="flex flex-col gap-4 p-2">
          <AppSearch onChange={e => setQuery(e.target.value)} placeholder={searchPlaceholder} value={query} />
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <>
                <HelpButton />
                <UserSettingsButton />
              </>
            ) : (
              <LoginButton />
            )}
          </div>
        </div>
      ) : null}

      <SidebarContent>
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
      </SidebarContent>
    </Sidebar>
  )
}

export default AppSidebar

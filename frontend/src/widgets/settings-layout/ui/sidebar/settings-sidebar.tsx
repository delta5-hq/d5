import { cn } from '@shared/lib/utils'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@shared/ui/sidebar'
import { AppSearch, HelpButton, UserSettingsButton } from '@widgets/app-layout'
import { AppWindow, User } from 'lucide-react'
import { useEffect, type FC } from 'react'
import { FormattedMessage } from 'react-intl'
import { Link, useLocation } from 'react-router-dom'
import styles from './settings-sidebar.module.scss'

interface SettingsSidebarProps {
  isResponsive?: boolean
  isDesktop?: boolean
  isMinimized?: boolean
}

const LOGGED_IN_ITEMS = [
  { titleId: 'settingsLayout.profileSettings', url: '/settings', icon: User },
  { titleId: 'settingsLayout.appsIntegrations', url: '/settings/apps', icon: AppWindow },
]

const AppSidebar: FC<SettingsSidebarProps> = ({ isResponsive, isDesktop, isMinimized }) => {
  const { isMobile, open, toggleSidebar } = useSidebar()
  const location = useLocation()

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
            {Icon ? (
              <Icon
                className={cn(
                  'w-5 h-5 text-muted-foreground group-active/menu-item:text-active',
                  isActive && styles.menuLinkText,
                )}
              />
            ) : null}
            <span className={cn('text-sm', isActive && styles.menuLinkText)}>
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
          <AppSearch />
          <div className="flex items-center gap-2">
            <HelpButton />
            <UserSettingsButton />
          </div>
        </div>
      ) : null}

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{LOGGED_IN_ITEMS.map(item => renderMenuItem(item.url, item.titleId, item.icon))}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

export default AppSidebar

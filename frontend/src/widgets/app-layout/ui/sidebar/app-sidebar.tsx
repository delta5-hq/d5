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
import { Calendar, Home, Inbox, Search, Settings } from 'lucide-react'
import { useEffect } from 'react'
import { FormattedMessage } from 'react-intl'
import { AppSearch, HelpButton, LoginButton, UserSettingsButton } from './../header'

import { useAuthContext } from '@entities/auth'
import { Link, useLocation } from 'react-router-dom'
import styles from './app-sidebar.module.scss'

interface AppSidebarProps {
  isResponsive?: boolean
  isDesktop?: boolean
  isMinimized?: boolean
}

const items = [
  {
    titleId: 'sidebarHomeLabel',
    url: '/',
    icon: Home,
  },
  {
    titleId: 'sidebarInboxLabel',
    url: '#',
    icon: Inbox,
  },
  {
    titleId: 'sidebarCalendarLabel',
    url: '#',
    icon: Calendar,
  },
  {
    titleId: 'sidebarSearchLabel',
    url: '#',
    icon: Search,
  },
  {
    titleId: 'sidebarSettingsLabel',
    url: '#',
    icon: Settings,
  },
]

const AppSidebar = ({ isResponsive, isDesktop, isMinimized }: AppSidebarProps) => {
  const { isMobile, open, toggleSidebar } = useSidebar()
  const location = useLocation()
  const { isLoggedIn } = useAuthContext()

  useEffect(() => {
    if (!open && !isResponsive && isDesktop) {
      toggleSidebar()
    }
  }, [open, toggleSidebar, isResponsive, isDesktop])

  return (
    <Sidebar
      className={cn(isMobile ? 'mt-16 p-2 border-sidebar-border' : 'pt-16', 'w-[175px]')}
      collapsible={isMinimized ? 'icon' : 'offcanvas'}
      disableOverlay={true}
      side={isMobile ? 'right' : 'left'}
      variant="sidebar"
    >
      {isMobile ? (
        <div className="flex flex-col gap-y-5 p-2">
          <AppSearch />
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
              {items.map(item => (
                <SidebarMenuItem
                  className={cn(location.pathname === item.url && styles.menuLinkButton)}
                  key={item.titleId}
                >
                  <SidebarMenuButton asChild>
                    <Link to={item.url}>
                      <item.icon
                        className={cn(
                          'group-active/menu-item:text-active',
                          location.pathname === item.url && styles.menuLinkText,
                        )}
                      />
                      <p
                        className={cn(
                          'group-active/menu-item:text-active',
                          location.pathname === item.url && styles.menuLinkText,
                        )}
                      >
                        <FormattedMessage id={item.titleId} />
                      </p>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

export default AppSidebar

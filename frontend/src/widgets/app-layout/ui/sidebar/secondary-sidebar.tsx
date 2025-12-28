import { useWorkflowManage } from '@entities/workflow'
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
} from '@shared/ui/sidebar'
import { type FC } from 'react'
import { FormattedMessage } from 'react-intl'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { SECTION_MENUS, getSectionGroupLabel, isMenuItemActive, type SecondaryMenuItem } from '../../config'
import styles from './app-sidebar.module.scss'

interface SecondarySidebarProps {
  isOpen: boolean
  activeSection?: string
}

const SecondarySidebar: FC<SecondarySidebarProps> = ({ isOpen, activeSection }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const { createEmpty, isCreating } = useWorkflowManage()

  if (!isOpen) return null

  const menuItems = activeSection && SECTION_MENUS[activeSection as keyof typeof SECTION_MENUS]

  if (!menuItems || menuItems.length === 0) return null

  const onCreate = async () => {
    const { workflowId } = await createEmpty()
    navigate(`/workflow/${workflowId}`)
  }

  const renderMenuItem = (item: SecondaryMenuItem, index: number) => {
    const { url, titleId, icon: Icon, action } = item
    const isActive = isMenuItemActive(url, location.pathname)

    // Special handling for Create Workflow action
    if (action === 'create') {
      return (
        <SidebarMenuItem key={titleId}>
          <SidebarMenuButton disabled={isCreating} onClick={onCreate}>
            <div className="flex items-center gap-2">
              {Icon ? <Icon className="w-5 h-5" /> : null}
              <span className="text-sm">
                <FormattedMessage id={titleId} />
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )
    }

    return (
      <SidebarMenuItem className={cn(isActive && styles.menuLinkButton)} key={`${titleId}-${index}`}>
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
      className="border-r border-sidebar-border"
      collapsible="none"
      data-testid="secondary-sidebar"
      side="left"
      style={{ width: '264px' }}
      variant="sidebar"
    >
      <SidebarContent className="p-2">
        <SidebarGroup>
          <SidebarGroupLabel>
            <FormattedMessage id={getSectionGroupLabel(activeSection ?? '')} />
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{menuItems.map((item, index) => renderMenuItem(item, index))}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {activeSection === 'home' ? (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>
                <FormattedMessage id="sidebarRecentItemsLabel" />
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {/* Placeholder for dynamic recent items */}
                  <SidebarMenuItem>
                    <SidebarMenuButton disabled>
                      <span className="text-sm text-muted-foreground">
                        <FormattedMessage id="sidebarNoRecentItems" />
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>
                <FormattedMessage id="sidebarTagsLabel" />
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {/* Placeholder for dynamic tag cloud */}
                  <SidebarMenuItem>
                    <SidebarMenuButton disabled>
                      <span className="text-sm text-muted-foreground">
                        <FormattedMessage id="sidebarNoTags" />
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : null}
      </SidebarContent>
    </Sidebar>
  )
}

export default SecondarySidebar

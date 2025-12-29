import { Sidebar, SidebarContent } from '@shared/ui/sidebar'
import { type FC } from 'react'
import { SECTION_MENUS } from '../../config'
import { SectionRenderer } from './sections/section-renderer'

interface SecondarySidebarProps {
  isOpen: boolean
  activeSection?: string
}

const SecondarySidebar: FC<SecondarySidebarProps> = ({ isOpen, activeSection }) => {
  if (!isOpen) return null

  const menuItems = activeSection && SECTION_MENUS[activeSection as keyof typeof SECTION_MENUS]

  if (!menuItems || menuItems.length === 0) return null

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
        <SectionRenderer activeSection={activeSection} menuItems={menuItems} />
      </SidebarContent>
    </Sidebar>
  )
}

export default SecondarySidebar

import { Sidebar, SidebarContent, SidebarFooter } from '@shared/ui/sidebar'
import { Version } from '@shared/ui/version'
import { type FC } from 'react'
import { SECTION_MENUS } from '../../config'
import { MobileCloseButton } from './components/mobile-close-button'
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
      className="border-r border-sidebar-border relative min-w-[264px] w-[264px] md:w-[264px] max-md:w-full max-md:min-w-full max-md:fixed max-md:inset-0 max-md:z-50"
      collapsible="none"
      data-testid="secondary-sidebar"
      side="left"
      variant="sidebar"
    >
      <MobileCloseButton />
      <SidebarContent className="p-2 flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 -mr-2 pr-2">
          <SectionRenderer activeSection={activeSection} menuItems={menuItems} />
        </div>
        <SidebarFooter className="flex-shrink-0 mt-2">
          <Version />
        </SidebarFooter>
      </SidebarContent>
    </Sidebar>
  )
}

export default SecondarySidebar

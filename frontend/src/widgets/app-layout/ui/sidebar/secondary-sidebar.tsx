import { Sidebar, SidebarContent, SidebarFooter, useSidebar } from '@shared/ui/sidebar'
import { SecondarySidebarVersion } from '@shared/ui/version'
import { GlassSheet, GlassSheetContent } from '@shared/ui/glass-sheet'
import { useDualSidebar } from '@shared/context'
import { type FC } from 'react'
import { SECTION_MENUS } from '../../config'
import { MobileCloseButton } from './components/mobile-close-button'
import { SectionRenderer } from './sections/section-renderer'

interface SecondarySidebarProps {
  isOpen: boolean
  activeSection?: string
}

const SecondarySidebar: FC<SecondarySidebarProps> = ({ isOpen, activeSection }) => {
  const { isMobile } = useSidebar()
  const { setSecondaryOpen } = useDualSidebar()

  if (!isOpen || !activeSection) return null

  const menuItems = SECTION_MENUS[activeSection as keyof typeof SECTION_MENUS]

  if (menuItems === undefined) return null

  const content = (
    <>
      <MobileCloseButton />
      <SidebarContent className="p-2 flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 -mr-2 pr-2">
          <SectionRenderer activeSection={activeSection} menuItems={menuItems} />
        </div>
        <SidebarFooter className="flex-shrink-0 mt-2">
          <SecondarySidebarVersion />
        </SidebarFooter>
      </SidebarContent>
    </>
  )

  if (isMobile) {
    return (
      <GlassSheet onOpenChange={open => !open && setSecondaryOpen?.(false)} open={isOpen}>
        <GlassSheetContent className="w-full" showCloseButton={false} side="left">
          {content}
        </GlassSheetContent>
      </GlassSheet>
    )
  }

  return (
    <Sidebar
      className="border-r border-sidebar-border relative min-w-[264px] w-[264px]"
      collapsible="none"
      data-testid="secondary-sidebar"
      side="left"
      variant="sidebar"
    >
      {content}
    </Sidebar>
  )
}

export { SecondarySidebar }

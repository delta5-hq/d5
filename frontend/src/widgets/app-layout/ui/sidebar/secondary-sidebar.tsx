import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar } from '@shared/ui/sidebar'
import { SecondarySidebarVersion } from '@shared/ui/version'
import { GlassSheet, GlassSheetContent } from '@shared/ui/glass-sheet'
import { MobileDismissArea } from '@shared/ui/mobile-dismiss-area'
import { useDualSidebar } from '@shared/context'
import { Logo } from '@shared/ui/logo'
import { type FC } from 'react'
import { SECTION_MENUS } from '../../config'
import { SecondarySidebarMobileHeader } from './components/secondary-sidebar-mobile-header'
import { SectionRenderer } from './sections/section-renderer'
import styles from './secondary-sidebar.module.scss'

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
    <SidebarContent className="p-2 flex flex-col overflow-hidden" style={{ height: '100%' }}>
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 -mr-2 pr-2">
        <SectionRenderer activeSection={activeSection} menuItems={menuItems} />
      </div>
      <SidebarFooter className="flex-shrink-0 mt-2">
        <SecondarySidebarVersion />
      </SidebarFooter>
    </SidebarContent>
  )

  const mobileContent = (
    <>
      <MobileDismissArea onDismiss={() => setSecondaryOpen?.(false)} />
      <div className={styles.mobileContentWrapper}>
        <SecondarySidebarMobileHeader onDismiss={() => setSecondaryOpen?.(false)} />
        <SidebarContent className="p-2 flex flex-col overflow-hidden" style={{ height: 'calc(100% - 56px)' }}>
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 -mr-2 pr-2">
            <SectionRenderer activeSection={activeSection} menuItems={menuItems} />
          </div>
          <SidebarFooter className="flex-shrink-0 mt-2">
            <SecondarySidebarVersion />
          </SidebarFooter>
        </SidebarContent>
      </div>
    </>
  )

  if (isMobile) {
    return (
      <GlassSheet onOpenChange={open => !open && setSecondaryOpen?.(false)} open={isOpen}>
        <GlassSheetContent
          className="w-full"
          data-testid="mobile-secondary-sidebar"
          showCloseButton={false}
          side="left"
        >
          {mobileContent}
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
      <SidebarHeader className={styles.secondaryHeader}>
        <Logo />
      </SidebarHeader>
      {content}
    </Sidebar>
  )
}

export { SecondarySidebar }

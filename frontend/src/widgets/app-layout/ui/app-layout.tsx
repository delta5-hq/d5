import { useResponsive } from '@shared/composables'
import { DualSidebarProvider, useDualSidebar } from '@shared/context'
import { SidebarProvider, useSidebar } from '@shared/ui/sidebar'
import React, { useEffect } from 'react'
import { AppHeader } from './header'
import PrimarySidebar from './sidebar/primary-sidebar'
import SecondarySidebar from './sidebar/secondary-sidebar'
import { Background, BackgroundContainer } from './background'

interface AppLayoutProps {
  children: React.ReactNode
  breakpoint?: number
  searchPlaceholder?: string
}

const AppLayoutContent = ({ children, breakpoint, searchPlaceholder }: AppLayoutProps) => {
  const { isResponsive } = useResponsive({ breakpoint })
  const { openMobile, setOpenMobile, isMobile } = useSidebar()
  const { secondaryOpen, setSecondaryOpen, activeSection, setActiveSection } = useDualSidebar()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isResponsive && isMobile && openMobile) {
        setOpenMobile(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isResponsive, isMobile, openMobile, setOpenMobile])

  const handleOpenSecondary = () => {
    if (!secondaryOpen) {
      setSecondaryOpen(true)
    }
  }

  return (
    <>
      <AppHeader breakpoint={breakpoint} searchPlaceholder={searchPlaceholder} />

      <div className="flex flex-1 overflow-hidden">
        <PrimarySidebar onOpenSecondary={handleOpenSecondary} onSectionChange={setActiveSection} />
        <SecondarySidebar activeSection={activeSection ?? undefined} isOpen={secondaryOpen} />

        <BackgroundContainer>
          <div className="relative h-full overflow-y-auto">
            <Background />
            <div className="h-full z-10 p-5">{children}</div>
          </div>
        </BackgroundContainer>
      </div>
    </>
  )
}

export const AppLayout = ({ children, breakpoint, searchPlaceholder }: AppLayoutProps) => (
  <SidebarProvider className="flex flex-col h-screen">
    <DualSidebarProvider>
      <AppLayoutContent breakpoint={breakpoint} searchPlaceholder={searchPlaceholder}>
        {children}
      </AppLayoutContent>
    </DualSidebarProvider>
  </SidebarProvider>
)

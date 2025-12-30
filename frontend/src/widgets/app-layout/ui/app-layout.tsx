import { useResponsive } from '@shared/composables'
import { DualSidebarProvider, useDualSidebar } from '@shared/context'
import { SidebarProvider, useSidebar } from '@shared/ui/sidebar'
import React, { useEffect } from 'react'
import { useRouteBasedSection } from '../hooks/use-route-based-section'
import { PrimarySidebar } from './sidebar/primary-sidebar'
import { SecondarySidebar } from './sidebar/secondary-sidebar'
import { Background, BackgroundContainer } from './background'

interface AppLayoutProps {
  children: React.ReactNode
  breakpoint?: number
}

const AppLayoutContent = ({ children, breakpoint }: AppLayoutProps) => {
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
    const actualIsMobile = typeof window !== 'undefined' && window.innerWidth < 768

    if (!actualIsMobile && !secondaryOpen) {
      setSecondaryOpen(true)
    }
  }

  useRouteBasedSection({
    currentActiveSection: activeSection,
    onSectionChange: setActiveSection,
    onSecondaryOpen: handleOpenSecondary,
    isMobile,
  })

  return (
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
  )
}

export const AppLayout = ({ children, breakpoint }: AppLayoutProps) => (
  <SidebarProvider className="flex flex-col h-screen">
    <DualSidebarProvider>
      <AppLayoutContent breakpoint={breakpoint}>{children}</AppLayoutContent>
    </DualSidebarProvider>
  </SidebarProvider>
)

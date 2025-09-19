import { useResponsive } from '@shared/composables'
import { SidebarProvider, useSidebar } from '@shared/ui/sidebar'
import React, { useEffect } from 'react'
import { AppHeader } from './header'
import { AppSidebar } from './sidebar'

interface AppLayoutProps {
  children: React.ReactNode
  breakpoint?: number
}

const AppLayoutContent = ({ children, breakpoint }: AppLayoutProps) => {
  const { isResponsive, isDesktop, isMinimized } = useResponsive({ breakpoint })
  const { openMobile, setOpenMobile, isMobile } = useSidebar()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isResponsive && isMobile && openMobile) {
        setOpenMobile(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isResponsive, isMobile, openMobile, setOpenMobile])

  return (
    <>
      <AppHeader breakpoint={breakpoint} />

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar isDesktop={isDesktop} isMinimized={isMinimized} isResponsive={isResponsive} />

        <main className="relative flex-1 p-5 overflow-auto">{children}</main>
      </div>
    </>
  )
}

export const AppLayout = ({ children, breakpoint }: AppLayoutProps) => (
  <SidebarProvider className="flex flex-col h-screen">
    <AppLayoutContent breakpoint={breakpoint}>{children}</AppLayoutContent>
  </SidebarProvider>
)

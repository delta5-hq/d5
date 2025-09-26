import { useResponsive } from '@shared/composables'
import { SidebarProvider, useSidebar } from '@shared/ui/sidebar'
import { AppHeader, Background, BackgroundContainer } from '@widgets/app-layout'
import React, { useEffect } from 'react'
import { SettingsSidebar } from './sidebar'
import { useAuthContext } from '@entities/auth'
import { useNavigate } from 'react-router-dom'
import { Spinner } from '@shared/ui/spinner'

interface SettingsLayoutProps {
  children: React.ReactNode
  breakpoint?: number
}

const SettingsLayoutContent = ({ children, breakpoint }: SettingsLayoutProps) => {
  const { isResponsive, isDesktop, isMinimized } = useResponsive({ breakpoint })
  const { openMobile, setOpenMobile, isMobile } = useSidebar()
  const { isLoggedIn, isLoading } = useAuthContext()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoggedIn && !isLoading) {
      navigate('/', { replace: true })
    }
  }, [isLoggedIn, isLoading, navigate])

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
        <SettingsSidebar isDesktop={isDesktop} isMinimized={isMinimized} isResponsive={isResponsive} />

        <BackgroundContainer>
          <div className="relative h-full overflow-y-auto">
            {/* Background component that grows with content */}
            <Background />
            {isLoading ? <Spinner /> : <div className="h-full z-10 p-5">{children}</div>}
          </div>
        </BackgroundContainer>
      </div>
    </>
  )
}

export const SettingsLayout = ({ children, breakpoint }: SettingsLayoutProps) => (
  <SidebarProvider className="flex flex-col h-screen">
    <SettingsLayoutContent breakpoint={breakpoint}>{children}</SettingsLayoutContent>
  </SidebarProvider>
)

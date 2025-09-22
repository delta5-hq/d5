import { useResponsive } from '@shared/composables'
import { SidebarTrigger, useSidebar } from '@shared/ui/sidebar'
import { HelpButton, LoginButton } from './help'
import MenuButton from './menu-button/menu-button'
import { AppSearch } from './search'
import { UserSettingsButton } from './user-settings'
import { useAuthContext } from '@entities/auth'
import { Logo } from '@shared/ui/logo'

interface HeaderProps {
  breakpoint?: number
}

const Header = ({ breakpoint }: HeaderProps) => {
  const { openMobile: sidebarOpened, toggleSidebar, isMobile } = useSidebar()
  const { isResponsive } = useResponsive({ breakpoint })
  const { isLoggedIn } = useAuthContext()
  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
      <div className="flex items-center gap-4 lg:gap-6">
        {!isMobile && isResponsive ? <SidebarTrigger className="cursor-pointer rounded-sm h-[30px] w-[30px]" /> : null}
        <Logo />
        {!isMobile ? <AppSearch className="h-9 w-64 lg:w-80" /> : null}
      </div>
      {!isMobile ? (
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
      ) : (
        <MenuButton opened={sidebarOpened} toggleButton={toggleSidebar} />
      )}
    </header>
  )
}

export default Header

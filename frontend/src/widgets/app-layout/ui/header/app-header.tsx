import { useResponsive } from '@shared/composables'
import { useSidebar } from '@shared/ui/sidebar'
import { LoginButton } from './help'
import { UserSettingsButton } from './user-settings'
import { SecondaryMenuToggle } from './secondary-menu-toggle'
import { useAuthContext } from '@entities/auth'
import { Logo } from '@shared/ui/logo'
import { ThemeSwitcher } from './theme-resolver'
import { CreateWorkflow } from './create-workflow/create-workflow'

interface HeaderProps {
  breakpoint?: number
}

const Header = ({ breakpoint }: HeaderProps) => {
  const { isMobile } = useSidebar()
  const { isResponsive } = useResponsive({ breakpoint })
  const { isLoggedIn } = useAuthContext()

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
      <div className="flex items-center gap-4 lg:gap-6">
        {isResponsive ? <SecondaryMenuToggle className="cursor-pointer rounded-sm h-[30px] w-[30px]" /> : null}
        <Logo />
      </div>

      <div className="flex flex-row items-center justify-between gap-x-2">
        <ThemeSwitcher />
        {!isMobile ? (
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <>
                <CreateWorkflow />
                <UserSettingsButton />
              </>
            ) : (
              <LoginButton />
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">{isLoggedIn ? <CreateWorkflow /> : <LoginButton />}</div>
        )}
      </div>
    </header>
  )
}

export default Header

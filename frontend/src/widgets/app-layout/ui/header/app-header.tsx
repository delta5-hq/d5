import { useResponsive } from '@shared/composables'
import { SidebarTrigger, useSidebar } from '@shared/ui/sidebar'
import { HelpButton, LoginButton } from './help'
import { AppSearch } from './search'
import { UserSettingsButton } from './user-settings'
import { useAuthContext } from '@entities/auth'
import { Logo } from '@shared/ui/logo'
import { ThemeSwitcher } from './theme-resolver'
import { CreateWorkflow } from './create-workflow/create-workflow'
import { useSearch } from '@shared/context'

interface HeaderProps {
  breakpoint?: number
  searchPlaceholder?: string
}

const Header = ({ breakpoint, searchPlaceholder }: HeaderProps) => {
  const { isMobile } = useSidebar()
  const { isResponsive } = useResponsive({ breakpoint })
  const { isLoggedIn } = useAuthContext()
  const { query, setQuery } = useSearch()

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
      <div className="flex items-center gap-4 lg:gap-6">
        {!isMobile && isResponsive ? <SidebarTrigger className="cursor-pointer rounded-sm h-[30px] w-[30px]" /> : null}
        <Logo />
        {!isMobile ? (
          <AppSearch
            className="h-9 w-64 lg:w-80"
            onChange={e => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            value={query}
          />
        ) : null}
      </div>

      <div className="flex flex-row items-center justify-between gap-x-2">
        <ThemeSwitcher />
        {!isMobile ? (
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <>
                <CreateWorkflow />
                <HelpButton />
                <UserSettingsButton />
              </>
            ) : (
              <LoginButton />
            )}
          </div>
        ) : (
          <CreateWorkflow />
        )}
      </div>
    </header>
  )
}

export default Header

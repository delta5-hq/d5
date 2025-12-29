import { useResponsive } from '@shared/composables'
import { SidebarTrigger, useSidebar } from '@shared/ui/sidebar'
import { useDualSidebar } from '@shared/context'
import { Menu } from 'lucide-react'
import { HelpButton, LoginButton } from './help'
import { AppSearch } from './search'
import { useAuthContext } from '@entities/auth'
import { Logo } from '@shared/ui/logo'
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
  const { secondaryOpen, setSecondaryOpen } = useDualSidebar()

  const handleHamburgerClick = () => {
    if (!isResponsive && secondaryOpen) {
      setSecondaryOpen(false)
    }
  }

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
      <div className="flex items-center gap-4 lg:gap-6">
        {isResponsive ? (
          <SidebarTrigger className="cursor-pointer rounded-sm h-[30px] w-[30px]" />
        ) : secondaryOpen ? (
          <button
            aria-label="Toggle secondary menu"
            className="cursor-pointer rounded-sm h-[30px] w-[30px] inline-flex items-center justify-center"
            onClick={handleHamburgerClick}
            type="button"
          >
            <Menu className="h-5 w-5" />
          </button>
        ) : null}
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
        {!isMobile ? (
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <>
                <CreateWorkflow />
                <HelpButton />
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

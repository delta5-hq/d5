import { delta5Logo } from '@shared/assets'
import { AppSearch } from '@shared/components/AppSearch'
import { HelpButton } from '@shared/components/HelpButton'
import { MenuButton } from '@shared/components/MenuButton'
import { SidebarTrigger, useSidebar } from '@shared/components/ui/sidebar'
import { UserSettingsButton } from '@shared/components/UserSettingsButton'
import { useResponsive } from '@shared/hooks/use-responsive'
import { Link } from 'react-router-dom'

interface HeaderProps {
  breakpoint?: number
}

const Header = ({ breakpoint }: HeaderProps) => {
  const { openMobile: sidebarOpened, toggleSidebar, isMobile } = useSidebar()
  const { isResponsive } = useResponsive({ breakpoint })
  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
      <div className="flex items-center gap-4 lg:gap-6">
        {!isMobile && isResponsive ? <SidebarTrigger className="cursor-pointer rounded-sm h-[30px] w-[30px]" /> : null}
        <Link to="/">
          <img alt="Delta5 logo" className="logo h-8 w-8" height={32} src={delta5Logo} width={32} />
        </Link>
        {!isMobile ? <AppSearch className="h-9 w-64 lg:w-80" /> : null}
      </div>
      {!isMobile ? (
        <div className="flex items-center gap-2">
          <HelpButton />
          <UserSettingsButton />
        </div>
      ) : (
        <MenuButton opened={sidebarOpened} toggleButton={toggleSidebar} />
      )}
    </header>
  )
}

export default Header

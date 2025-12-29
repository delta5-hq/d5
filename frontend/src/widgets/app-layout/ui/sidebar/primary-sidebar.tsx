import { useAuthContext } from '@entities/auth'
import { cn } from '@shared/lib/utils'
import { type FC, useRef, useState, useEffect } from 'react'
import { PRIMARY_NAV_ITEMS, filterVisibleNavItems, type NavItem } from '../../config'
import { NavigationList } from './components/navigation-list'
import { SidebarFooter } from './components/sidebar-footer'
import styles from './primary-sidebar.module.scss'

interface PrimarySidebarProps {
  onSectionChange?: (section: string) => void
  onOpenSecondary?: () => void
}

const PrimarySidebar: FC<PrimarySidebarProps> = ({ onSectionChange, onOpenSecondary }) => {
  const { isLoggedIn, isAdmin } = useAuthContext()
  const visibleItems = filterVisibleNavItems(PRIMARY_NAV_ITEMS, isLoggedIn ?? false, isAdmin ?? false)
  const navRef = useRef<HTMLElement>(null)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const navElement = navRef.current
    if (!navElement) return

    const handleScroll = () => {
      setIsScrolled(navElement.scrollTop > 5)
    }

    navElement.addEventListener('scroll', handleScroll)
    return () => navElement.removeEventListener('scroll', handleScroll)
  }, [])

  const handleItemClick = (item: NavItem) => {
    if (item.id === 'create') {
      onSectionChange?.(item.id)
      onOpenSecondary?.()
      return
    }

    onSectionChange?.(item.id)
    onOpenSecondary?.()
  }

  return (
    <aside
      className={cn(styles.primarySidebar, isScrolled && styles.primarySidebarScrolled)}
      data-testid="primary-sidebar"
    >
      <nav className={styles.primaryNav} ref={navRef}>
        <NavigationList items={visibleItems} onItemClick={handleItemClick} />
        <SidebarFooter onOpenSecondary={onOpenSecondary} onSectionChange={onSectionChange} />
      </nav>
    </aside>
  )
}

export default PrimarySidebar

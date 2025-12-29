import { useAuthContext } from '@entities/auth'
import { cn } from '@shared/lib/utils'
import { type FC } from 'react'
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
    <aside className={cn(styles.primarySidebar)} data-testid="primary-sidebar">
      <nav className={styles.primaryNav}>
        <NavigationList items={visibleItems} onItemClick={handleItemClick} />
        <SidebarFooter />
      </nav>
    </aside>
  )
}

export default PrimarySidebar

import { useAuthContext } from '@entities/auth'
import { cn } from '@shared/lib/utils'
import { User } from 'lucide-react'
import { type FC } from 'react'
import { FormattedMessage } from 'react-intl'
import { Link, useLocation } from 'react-router-dom'
import { PRIMARY_NAV_ITEMS, filterVisibleNavItems, isNavItemActive, type NavItem } from '../../config'
import styles from './primary-sidebar.module.scss'

interface PrimarySidebarProps {
  onSectionChange?: (section: string) => void
  onOpenSecondary?: () => void
}

const PrimarySidebar: FC<PrimarySidebarProps> = ({ onSectionChange, onOpenSecondary }) => {
  const location = useLocation()
  const { isLoggedIn, isAdmin } = useAuthContext()

  const visibleItems = filterVisibleNavItems(PRIMARY_NAV_ITEMS, isLoggedIn ?? false, isAdmin ?? false)

  const handleItemClick = (item: NavItem) => {
    if (item.id === 'create') {
      if (onSectionChange) {
        onSectionChange(item.id)
      }
      if (onOpenSecondary) {
        onOpenSecondary()
      }
      return
    }

    if (onSectionChange) {
      onSectionChange(item.id)
    }
    if (onOpenSecondary) {
      onOpenSecondary()
    }
  }

  return (
    <aside className={cn(styles.primarySidebar)} data-testid="primary-sidebar">
      <nav className={styles.primaryNav}>
        {visibleItems.map(item => {
          const Icon = item.icon
          const isActive = isNavItemActive(item, location.pathname)

          if (item.id === 'create') {
            return (
              <div
                className={cn(styles.primaryNavItem, isActive && styles.primaryNavItemActive)}
                data-testid={`primary-nav-${item.id}`}
                key={item.id}
                onClick={() => handleItemClick(item)}
                role="button"
                tabIndex={0}
              >
                <div className={styles.primaryNavButton}>
                  <Icon className="w-6 h-6" />
                </div>
                <span className={styles.primaryNavLabel}>
                  <FormattedMessage id={item.titleId} />
                </span>
              </div>
            )
          }

          return (
            <Link
              className={cn(styles.primaryNavItem, isActive && styles.primaryNavItemActive)}
              data-testid={`primary-nav-${item.id}`}
              key={item.id}
              onClick={() => handleItemClick(item)}
              to={item.url}
            >
              <div className={styles.primaryNavButton}>
                <Icon className="w-6 h-6" />
              </div>
              <span className={styles.primaryNavLabel}>
                <FormattedMessage id={item.titleId} />
              </span>
            </Link>
          )
        })}
      </nav>
      <div className={styles.primaryFooter}>
        <div className={styles.primaryFooterIcon}>
          <User className="w-5 h-5" />
        </div>
      </div>
    </aside>
  )
}

export default PrimarySidebar

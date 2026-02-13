import { type FC, type ReactNode } from 'react'
import { FormattedMessage } from 'react-intl'
import { Link } from 'react-router-dom'
import { cn } from '@shared/lib/utils'
import type { NavItem } from '../../../config'
import styles from '../primary-sidebar.module.scss'

interface NavItemProps {
  item: NavItem
  isActive: boolean
  onClick: () => void
  customWrapper?: (element: ReactNode) => ReactNode
}

export const NavigationItem: FC<NavItemProps> = ({ item, isActive, onClick, customWrapper }) => {
  const Icon = item.icon
  const className = cn(
    styles.primaryNavItem,
    isActive && styles.primaryNavItemActive,
    item.id === 'create' && styles.primaryNavItemCreate,
  )

  const content = (
    <>
      <div className={styles.primaryNavButton}>
        <Icon className="w-6 h-6" />
      </div>
      <span className={styles.primaryNavLabel}>
        <FormattedMessage id={item.titleId} />
      </span>
    </>
  )

  const navElement =
    item.id === 'create' ? (
      <div
        className={className}
        data-active={isActive}
        data-testid={`primary-nav-${item.id}`}
        onClick={onClick}
        role="button"
        tabIndex={0}
      >
        {content}
      </div>
    ) : (
      <Link
        className={className}
        data-active={isActive}
        data-testid={`primary-nav-${item.id}`}
        onClick={onClick}
        to={item.url}
      >
        {content}
      </Link>
    )

  if (customWrapper) {
    return <>{customWrapper(navElement)}</>
  }

  return navElement
}

import { type FC } from 'react'
import { FormattedMessage } from 'react-intl'
import { Link } from 'react-router-dom'
import { cn } from '@shared/lib/utils'
import type { NavItem } from '../../../config'
import styles from '../primary-sidebar.module.scss'

interface NavItemProps {
  item: NavItem
  isActive: boolean
  onClick: () => void
}

export const NavigationItem: FC<NavItemProps> = ({ item, isActive, onClick }) => {
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

  if (item.id === 'create') {
    return (
      <div className={className} data-testid={`primary-nav-${item.id}`} onClick={onClick} role="button" tabIndex={0}>
        {content}
      </div>
    )
  }

  return (
    <Link className={className} data-testid={`primary-nav-${item.id}`} onClick={onClick} to={item.url}>
      {content}
    </Link>
  )
}

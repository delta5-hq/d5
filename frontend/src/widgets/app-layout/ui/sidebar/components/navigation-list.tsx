import { type FC, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { isNavItemActive, type NavItem } from '../../../config'
import { NavigationItem } from './navigation-item'
import styles from '../primary-sidebar.module.scss'

interface NavigationListProps {
  items: NavItem[]
  onItemClick: (item: NavItem) => void
  customWrapper?: (item: NavItem, element: ReactNode) => ReactNode
}

export const NavigationList: FC<NavigationListProps> = ({ items, onItemClick, customWrapper }) => {
  const location = useLocation()

  return (
    <div className={styles.primaryNavItems}>
      {items.map(item => (
        <NavigationItem
          customWrapper={customWrapper ? element => customWrapper(item, element) : undefined}
          isActive={isNavItemActive(item, location.pathname)}
          item={item}
          key={item.id}
          onClick={() => onItemClick(item)}
        />
      ))}
    </div>
  )
}

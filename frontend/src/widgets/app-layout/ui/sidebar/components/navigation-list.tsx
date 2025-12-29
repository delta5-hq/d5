import { type FC } from 'react'
import { useLocation } from 'react-router-dom'
import { isNavItemActive, type NavItem } from '../../../config'
import { NavigationItem } from './navigation-item'
import styles from '../primary-sidebar.module.scss'

interface NavigationListProps {
  items: NavItem[]
  onItemClick: (item: NavItem) => void
}

export const NavigationList: FC<NavigationListProps> = ({ items, onItemClick }) => {
  const location = useLocation()

  return (
    <div className={styles.primaryNavItems}>
      {items.map(item => (
        <NavigationItem
          isActive={isNavItemActive(item, location.pathname)}
          item={item}
          key={item.id}
          onClick={() => onItemClick(item)}
        />
      ))}
    </div>
  )
}

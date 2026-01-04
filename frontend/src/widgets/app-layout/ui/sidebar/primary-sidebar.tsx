import { useAuthContext } from '@entities/auth'
import { CreatePopover } from '@features/create-popover'
import { cn } from '@shared/lib/utils'
import { useDualSidebar } from '@shared/context'
import { Button } from '@shared/ui/button'
import { type FC, useRef, useState, useEffect, type ReactNode } from 'react'
import { PRIMARY_NAV_ITEMS, filterVisibleNavItems, type NavItem } from '../../config'
import { useWorkflowActions } from '../../hooks/use-workflow-actions'
import { NavigationList } from './components/navigation-list'
import { SidebarFooter } from './components/sidebar-footer'
import { HamburgerIcon } from './components/hamburger-icon'
import styles from './primary-sidebar.module.scss'

interface PrimarySidebarProps {
  onSectionChange?: (section: string) => void
  onOpenSecondary?: () => void
}

const PrimarySidebar: FC<PrimarySidebarProps> = ({ onSectionChange, onOpenSecondary }) => {
  const { isLoggedIn, isAdmin } = useAuthContext()
  const { createWorkflow } = useWorkflowActions()
  const { toggleSecondary, secondaryOpen } = useDualSidebar()
  const visibleItems = filterVisibleNavItems(PRIMARY_NAV_ITEMS, isLoggedIn ?? false, isAdmin ?? false)
  const navRef = useRef<HTMLElement>(null)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(false)

  useEffect(() => {
    const navElement = navRef.current
    if (!navElement) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = navElement
      const atTop = scrollTop <= 5
      const atBottom = scrollTop + clientHeight >= scrollHeight - 5

      setIsScrolled(!atTop)
      setIsAtBottom(atBottom)
    }

    navElement.addEventListener('scroll', handleScroll)
    handleScroll()
    return () => navElement.removeEventListener('scroll', handleScroll)
  }, [])

  const handleItemClick = (item: NavItem) => {
    if (item.id !== 'create') {
      onSectionChange?.(item.id)
      onOpenSecondary?.()
    }
  }

  const wrapWithCreatePopover = (item: NavItem, element: ReactNode) => {
    if (item.id === 'create') {
      return <CreatePopover onCreateWorkflow={createWorkflow} trigger={element} />
    }
    return element
  }

  return (
    <aside
      className={cn(styles.primarySidebar, isScrolled && styles.primarySidebarScrolled)}
      data-testid="primary-sidebar"
    >
      <div className={styles.primaryHeader}>
        <Button
          aria-label="Toggle menu"
          className={styles.hamburgerButton}
          onClick={toggleSecondary}
          size="icon"
          variant="ghost"
        >
          <HamburgerIcon className="h-6 w-6" isOpen={secondaryOpen} />
        </Button>
      </div>
      <nav className={styles.primaryNav} ref={navRef}>
        <NavigationList customWrapper={wrapWithCreatePopover} items={visibleItems} onItemClick={handleItemClick} />
        <SidebarFooter isAtBottom={isAtBottom} onOpenSecondary={onOpenSecondary} onSectionChange={onSectionChange} />
      </nav>
    </aside>
  )
}

export { PrimarySidebar }

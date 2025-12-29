import { useAuthContext } from '@entities/auth'
import { UserPopover } from '@features/user-popover'
import { ThemePopover } from '@features/theme-popover'
import { User } from 'lucide-react'
import { type FC } from 'react'
import { cn } from '@shared/lib/utils'
import styles from '../primary-sidebar.module.scss'

interface SidebarFooterProps {
  onSectionChange?: (section: string) => void
  onOpenSecondary?: () => void
  isAtBottom?: boolean
}

export const SidebarFooter: FC<SidebarFooterProps> = ({ onSectionChange, onOpenSecondary, isAtBottom }) => {
  const { isLoggedIn } = useAuthContext()

  return (
    <div className={cn(styles.primaryFooter, isAtBottom && styles.primaryFooterScrolledToBottom)}>
      {isLoggedIn ? (
        <UserPopover
          onOpenSecondary={onOpenSecondary}
          onSectionChange={onSectionChange}
          trigger={
            <button className={styles.primaryFooterIcon} type="button">
              <User className="w-5 h-5" />
            </button>
          }
        />
      ) : (
        <ThemePopover />
      )}
    </div>
  )
}

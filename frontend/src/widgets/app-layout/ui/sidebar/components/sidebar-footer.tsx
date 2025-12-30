import { useAuthContext } from '@entities/auth'
import { UserPopover } from '@features/user-popover'
import { HelpPopover } from '@features/help-popover'
import { ThemePopover } from '@features/theme-popover'
import { User, HelpCircle } from 'lucide-react'
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
      <HelpPopover
        trigger={
          <button className={styles.primaryFooterIcon} type="button">
            <HelpCircle className="w-5 h-5" />
          </button>
        }
      />
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

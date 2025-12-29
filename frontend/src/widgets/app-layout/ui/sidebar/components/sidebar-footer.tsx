import { UserPopover } from '@features/user-popover'
import { User } from 'lucide-react'
import { type FC } from 'react'
import styles from '../primary-sidebar.module.scss'

interface SidebarFooterProps {
  onSectionChange?: (section: string) => void
  onOpenSecondary?: () => void
}

export const SidebarFooter: FC<SidebarFooterProps> = ({ onSectionChange, onOpenSecondary }) => (
  <div className={styles.primaryFooter}>
    <UserPopover
      onOpenSecondary={onOpenSecondary}
      onSectionChange={onSectionChange}
      trigger={
        <button className={styles.primaryFooterIcon} type="button">
          <User className="w-5 h-5" />
        </button>
      }
    />
  </div>
)

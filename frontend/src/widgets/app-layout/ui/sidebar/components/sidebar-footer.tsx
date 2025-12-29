import { User } from 'lucide-react'
import { type FC } from 'react'
import styles from '../primary-sidebar.module.scss'

export const SidebarFooter: FC = () => (
  <div className={styles.primaryFooter}>
    <div className={styles.primaryFooterIcon}>
      <User className="w-5 h-5" />
    </div>
  </div>
)

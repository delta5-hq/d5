import { type FC } from 'react'
import { Logo } from '@shared/ui/logo'
import { MobileHeaderDismissButton } from '../mobile-header-dismiss-button'
import styles from './secondary-sidebar-mobile-header.module.scss'

interface SecondarySidebarMobileHeaderProps {
  onDismiss: () => void
}

export const SecondarySidebarMobileHeader: FC<SecondarySidebarMobileHeaderProps> = ({ onDismiss }) => (
  <div className={styles.mobileHeader}>
    <MobileHeaderDismissButton onDismiss={onDismiss} />
    <Logo />
  </div>
)

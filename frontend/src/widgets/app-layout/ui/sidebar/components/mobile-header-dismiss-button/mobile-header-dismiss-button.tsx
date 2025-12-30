import { type FC } from 'react'
import { HamburgerIcon } from '../hamburger-icon'
import styles from './mobile-header-dismiss-button.module.scss'

interface MobileHeaderDismissButtonProps {
  onDismiss: () => void
  ariaLabel?: string
}

export const MobileHeaderDismissButton: FC<MobileHeaderDismissButtonProps> = ({
  onDismiss,
  ariaLabel = 'Close menu',
}) => (
  <button aria-label={ariaLabel} className={styles.dismissButton} onClick={onDismiss} type="button">
    <HamburgerIcon className="h-6 w-6" isOpen />
  </button>
)

import styles from './mobile-dismiss-area.module.scss'

interface MobileDismissAreaProps {
  onDismiss: () => void
}

export const MobileDismissArea = ({ onDismiss }: MobileDismissAreaProps) => (
  <button aria-label="Close menu" className={styles.gripButton} onClick={onDismiss} type="button">
    <svg className={styles.gripArrow} fill="currentColor" viewBox="0 0 6 30" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 10L0 15L6 20Z" />
    </svg>
  </button>
)

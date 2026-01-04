import { FormattedMessage } from 'react-intl'
import styles from './help-menu-content.module.scss'

interface HelpMenuContentProps {
  onNavigate?: () => void
}

const HELP_MENU_ITEMS = [
  { id: 'helpMenuTutorials', href: '#tutorials' },
  { id: 'helpMenuReference', href: '#terraform' },
  { id: 'helpMenuChangelog', href: '#changelog' },
] as const

const HELP_SUPPORT_ITEMS = [
  { id: 'helpMenuCreateSupportTicket', href: '#support' },
  { id: 'helpMenuGiveFeedback', href: '#feedback' },
] as const

export const HelpMenuContent = ({ onNavigate }: HelpMenuContentProps) => {
  const handleItemClick = (_href: string) => {
    onNavigate?.()
  }

  return (
    <div className={styles.helpMenuContainer}>
      <div className={styles.helpMenuHeader}>
        <p className={styles.helpMenuTitle}>
          <FormattedMessage id="helpMenuLabel" />
        </p>
      </div>

      <div className={styles.helpMenuDivider} />

      {HELP_MENU_ITEMS.map(item => (
        <button className={styles.helpMenuItem} key={item.id} onClick={() => handleItemClick(item.href)} type="button">
          <FormattedMessage id={item.id} />
        </button>
      ))}

      <div className={styles.helpMenuDivider} />

      {HELP_SUPPORT_ITEMS.map(item => (
        <button className={styles.helpMenuItem} key={item.id} onClick={() => handleItemClick(item.href)} type="button">
          <FormattedMessage id={item.id} />
        </button>
      ))}
    </div>
  )
}

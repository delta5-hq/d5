import { Settings, User } from 'lucide-react'
import { FormattedMessage } from 'react-intl'
import { useNavigate } from 'react-router-dom'
import styles from './quick-actions-grid.module.scss'

interface QuickActionsGridProps {
  onNavigate?: () => void
  onSectionChange?: (section: string) => void
  onOpenSecondary?: () => void
}

export const QuickActionsGrid = ({ onNavigate, onSectionChange, onOpenSecondary }: QuickActionsGridProps) => {
  const navigate = useNavigate()

  const handleSettings = () => {
    onSectionChange?.('settings')
    onOpenSecondary?.()
    navigate('/settings')
    onNavigate?.()
  }

  const handleProfile = () => {
    navigate('/profile')
    onNavigate?.()
  }

  return (
    <div className={styles.quickActionsGrid}>
      <button className={styles.actionButton} data-testid="settings-button" onClick={handleSettings} type="button">
        <Settings />
        <FormattedMessage id="sidebarSettingsLabel" />
      </button>
      <button className={styles.actionButton} data-testid="profile-button" onClick={handleProfile} type="button">
        <User />
        <FormattedMessage id="settingsPageProfile" />
      </button>
    </div>
  )
}

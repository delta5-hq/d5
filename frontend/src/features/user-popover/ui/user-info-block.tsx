import { useAuthContext } from '@entities/auth'
import { Button } from '@shared/ui/button'
import { LogOut } from 'lucide-react'
import { FormattedMessage } from 'react-intl'
import { useNavigate } from 'react-router-dom'
import styles from './user-info-block.module.scss'

interface UserInfoBlockProps {
  onNavigate?: () => void
}

export const UserInfoBlock = ({ onNavigate }: UserInfoBlockProps) => {
  const { user, logout } = useAuthContext()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/')
    onNavigate?.()
  }

  return (
    <div className={styles.userInfoBlock}>
      <div className={styles.userDetails}>
        <div className={styles.userName}>
          <span className="truncate">{user?.name}</span>
        </div>
        <p className={styles.userSubtitle}>
          <FormattedMessage id="userSettingsMenuSignedIn" />
        </p>
      </div>
      <Button
        className={styles.logoutButton}
        datatype="logout"
        onClick={handleLogout}
        size="icon"
        title="Log out"
        variant="ghost"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  )
}

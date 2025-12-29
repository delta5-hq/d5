import { useAuthContext } from '@entities/auth'
import { Button } from '@shared/ui/button'
import { Separator } from '@shared/ui/separator'
import { LogOut } from 'lucide-react'
import { FormattedMessage } from 'react-intl'
import { useNavigate } from 'react-router-dom'

interface UserMenuContentProps {
  onNavigate?: () => void
  onSectionChange?: (section: string) => void
  onOpenSecondary?: () => void
}

export const UserMenuContent = ({ onNavigate, onSectionChange, onOpenSecondary }: UserMenuContentProps) => {
  const { user, logout } = useAuthContext()
  const navigate = useNavigate()

  const handleSettings = () => {
    onSectionChange?.('settings')
    onOpenSecondary?.()
    navigate('/settings')
    onNavigate?.()
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
    onNavigate?.()
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between pb-2">
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <p className="text-base font-semibold truncate">{user?.name}</p>
          <p className="text-xs text-muted-foreground">
            <FormattedMessage id="userSettingsMenuSignedIn" />
          </p>
        </div>
        <Button
          className="shrink-0 h-8 w-8"
          datatype="logout"
          onClick={handleLogout}
          size="icon"
          title="Log out"
          variant="ghost"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      <Separator />

      <Button className="w-full justify-start" onClick={handleSettings} size="sm" variant="ghost">
        <FormattedMessage id="sidebarSettingsLabel" />
      </Button>
    </div>
  )
}

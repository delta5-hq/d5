import { FormattedMessage } from 'react-intl'
import { useDialog } from '@entities/dialog'
import { LoginDialog } from '@entities/auth/ui/login-dialog'

export const LoginLink = () => {
  const { showDialog } = useDialog()

  return (
    <div className="flex flex-row items-center justify-center gap-2 text-sm">
      <span className="text-muted-foreground">
        <FormattedMessage id="alreadyExistAccount" />
      </span>
      <span
        className="text-link hover:text-link-hover hover:underline cursor-pointer transition-colors font-medium"
        data-type="login"
        onClick={() => showDialog(LoginDialog)}
      >
        <FormattedMessage id="loginTitle" />
      </span>
    </div>
  )
}

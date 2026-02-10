import { Link, useNavigate } from 'react-router-dom'
import { FormattedMessage } from 'react-intl'
import { useDialog } from '@entities/dialog'
import { LoginDialog } from '../index'

interface NavigationLinksProps {
  onClose?: () => void
}

export const ForgotPasswordLink = ({ onClose }: NavigationLinksProps) => (
  <Link
    className="text-sm text-link hover:text-link-hover hover:underline cursor-pointer transition-colors"
    onClick={() => onClose?.()}
    to="/forgot-password"
  >
    <FormattedMessage id="loginForgotPassword" />
  </Link>
)

export const SignUpLink = ({ onClose }: NavigationLinksProps) => (
  <div className="flex flex-row items-center justify-center gap-2 text-sm">
    <span className="text-muted-foreground">
      <FormattedMessage id="notRegistered" />
    </span>
    <Link
      className="text-link hover:text-link-hover hover:underline cursor-pointer transition-colors font-medium"
      onClick={() => onClose?.()}
      to="/register"
    >
      <FormattedMessage id="loginSignUp" />
    </Link>
  </div>
)

export const LoginNavigationLink = () => {
  const navigate = useNavigate()
  const { showDialog } = useDialog()

  return (
    <button
      className="text-center text-sm text-link hover:text-link-hover hover:underline cursor-pointer transition-colors"
      onClick={() => {
        navigate('/')
        showDialog(LoginDialog)
      }}
      type="button"
    >
      <FormattedMessage id="loginTitle" />
    </button>
  )
}

export const CancelNavigationLink = () => {
  const navigate = useNavigate()

  return (
    <button
      className="text-center text-sm text-muted-foreground hover:text-foreground hover:underline cursor-pointer transition-colors"
      onClick={() => navigate('/')}
      type="button"
    >
      <FormattedMessage id="buttonCancel" />
    </button>
  )
}

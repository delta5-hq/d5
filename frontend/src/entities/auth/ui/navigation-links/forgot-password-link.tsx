import { Link } from 'react-router-dom'
import { FormattedMessage } from 'react-intl'

interface ForgotPasswordLinkProps {
  onClose?: () => void
}

export const ForgotPasswordLink = ({ onClose }: ForgotPasswordLinkProps) => (
  <Link
    className="text-sm text-link hover:text-link-hover hover:underline cursor-pointer transition-colors"
    onClick={() => onClose?.()}
    to="/forgot-password"
  >
    <FormattedMessage id="loginForgotPassword" />
  </Link>
)

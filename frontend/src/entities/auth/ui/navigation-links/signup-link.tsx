import { Link } from 'react-router-dom'
import { FormattedMessage } from 'react-intl'

interface SignUpLinkProps {
  onClose?: () => void
}

export const SignUpLink = ({ onClose }: SignUpLinkProps) => (
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

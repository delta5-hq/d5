import { Link } from 'react-router-dom'
import { FormattedMessage } from 'react-intl'

export const ForgotPasswordLink = () => (
  <div className="text-center">
    <Link className="text-sm text-link hover:text-link-hover hover:underline" to="/forgot-password">
      <FormattedMessage id="loginForgotPassword" />
    </Link>
  </div>
)

export const RegisterLink = () => (
  <div className="flex justify-center gap-2 text-sm">
    <span className="text-muted-foreground">
      <FormattedMessage id="notRegistered" />
    </span>
    <Link className="text-link hover:text-link-hover hover:underline" to="/register">
      <FormattedMessage id="loginSignUp" />
    </Link>
  </div>
)

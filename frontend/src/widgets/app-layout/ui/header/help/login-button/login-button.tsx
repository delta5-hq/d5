import { LoginDialog } from '@entities/auth'
import { Button } from '@shared/ui/button'
import { FormattedMessage } from 'react-intl'
import type { LoginButtonProps } from './types'

const LoginButton = ({ login }: LoginButtonProps) => (
  <LoginDialog login={login}>
    <Button>
      <FormattedMessage id="loginTitle" />
    </Button>
  </LoginDialog>
)

export default LoginButton

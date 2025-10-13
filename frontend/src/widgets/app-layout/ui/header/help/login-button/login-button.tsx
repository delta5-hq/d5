import { LoginDialog } from '@entities/auth'
import { useDialog } from '@entities/dialog'
import { Button } from '@shared/ui/button'
import { FormattedMessage } from 'react-intl'

const LoginButton = () => {
  const { showDialog } = useDialog()

  return (
    <Button data-type="login" onClick={() => showDialog(LoginDialog)}>
      <FormattedMessage id="loginTitle" />
    </Button>
  )
}

export default LoginButton

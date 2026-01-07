import { GlassAuthDialog } from '@shared/ui/glass-auth-dialog'
import { PrimaryDialogButton } from '@shared/ui/primary-dialog-button'
import { FormattedMessage } from 'react-intl'
import { SuccessIcon } from './success-icon'
import { SuccessMessage } from './success-message'
import type { ThankYouDialogProps } from './types'

export const ThankYouDialog = ({ open, onClose }: ThankYouDialogProps) => {
  const handleClose = () => {
    onClose?.()
  }

  return (
    <GlassAuthDialog hideHeader onClose={handleClose} open={open}>
      <SuccessIcon />
      <SuccessMessage messageId="signupDialogMessage" titleId="signupDialogTitle" />
      <PrimaryDialogButton onClick={handleClose}>
        <FormattedMessage id="OK" />
      </PrimaryDialogButton>
    </GlassAuthDialog>
  )
}

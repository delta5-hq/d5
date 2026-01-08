import { GlassAuthDialog } from '@shared/ui/glass-auth-dialog'
import { PrimaryDialogButton } from '@shared/ui/primary-dialog-button'
import { FormattedMessage } from 'react-intl'
import { SuccessIcon } from '../thank-you-dialog/success-icon'
import { EmailMessage } from './email-message'
import type { EmailSentDialogProps } from './types'

export const EmailSentDialog = ({ open, onClose }: EmailSentDialogProps) => {
  const handleClose = () => {
    onClose?.()
  }

  return (
    <GlassAuthDialog hideHeader onClose={handleClose} open={open}>
      <SuccessIcon />
      <EmailMessage messageId="forgotPasswordDialogMessage" titleId="forgotPasswordDialogTitle" />
      <PrimaryDialogButton onClick={handleClose}>
        <FormattedMessage id="OK" />
      </PrimaryDialogButton>
    </GlassAuthDialog>
  )
}

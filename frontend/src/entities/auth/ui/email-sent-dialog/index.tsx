import { Dialog, DialogContent } from '@shared/ui/dialog'
import { CloseButton } from './close-button'
import { EmailIcon } from './email-icon'
import { EmailMessage } from './email-message'
import type { EmailSentDialogProps } from './types'

export const EmailSentDialog = ({ open, onClose }: EmailSentDialogProps) => {
  const handleClose = () => {
    onClose?.()
  }

  return (
    <Dialog onOpenChange={val => !val && handleClose()} open={open}>
      <DialogContent className="max-w-md w-full p-8 bg-card/95 backdrop-blur-xl border border-card-foreground/10">
        <EmailIcon />
        <EmailMessage messageId="forgotPasswordDialogMessage" titleId="forgotPasswordDialogTitle" />
        <CloseButton onClick={handleClose} />
      </DialogContent>
    </Dialog>
  )
}

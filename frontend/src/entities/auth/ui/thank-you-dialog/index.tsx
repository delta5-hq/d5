import { Dialog, DialogContent } from '@shared/ui/dialog'
import { ActionButton } from './action-button'
import { SuccessIcon } from './success-icon'
import { SuccessMessage } from './success-message'
import type { ThankYouDialogProps } from './types'

export const ThankYouDialog = ({ open, onClose }: ThankYouDialogProps) => {
  const handleClose = () => {
    onClose?.()
  }

  return (
    <Dialog onOpenChange={val => !val && handleClose()} open={open}>
      <DialogContent className="max-w-md w-full p-8 bg-card/95 backdrop-blur-xl border border-card-foreground/10">
        <SuccessIcon />
        <SuccessMessage messageId="signupDialogMessage" titleId="signupDialogTitle" />
        <ActionButton onClick={handleClose} />
      </DialogContent>
    </Dialog>
  )
}

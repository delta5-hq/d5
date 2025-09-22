import React from 'react'
import { FormattedMessage, useIntl } from 'react-intl'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'

type AlertDialogProps = {
  title: React.ReactNode
  translationKey: string
  open: boolean
  onClose: () => void
  onConfirm: () => void
}

export const AlertDialog: React.FC<AlertDialogProps> = ({ title, translationKey, open, onClose, onConfirm }) => {
  const { formatMessage } = useIntl()
  const message = formatMessage({ id: translationKey })

  return (
    <Dialog onOpenChange={v => !v && onClose()} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {/* eslint-disable-next-line react/no-danger */}
            <span dangerouslySetInnerHTML={{ __html: message }} />
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onConfirm}>
            <FormattedMessage id="OK" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AlertDialog

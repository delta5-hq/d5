import React from 'react'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@shared/ui/dialog'
import { FormattedMessage } from 'react-intl'
import type { DialogProps } from '@shared/base-types'

interface ConfirmationDialogProps extends DialogProps {
  headline?: string | React.ReactNode
  question?: string | React.ReactNode
  onYes?: () => void
  onNo?: () => void
  yesTextId?: string
  noTextId?: string
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  open,
  onClose,
  headline,
  question,
  onYes,
  onNo,
  yesTextId = 'yes',
  noTextId = 'no',
}) => {
  const onConfirm = () => {
    onYes?.()
    onClose?.()
  }

  const onNotConfirm = () => {
    onNo?.()
    onClose?.()
  }

  return (
    <Dialog onOpenChange={onNotConfirm} open={open}>
      <DialogContent className="sm:max-w-lg">
        {headline ? (
          <DialogHeader>
            <DialogTitle>{typeof headline === 'string' ? <FormattedMessage id={headline} /> : headline}</DialogTitle>
          </DialogHeader>
        ) : null}
        {question ? (
          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            {typeof question === 'string' ? <FormattedMessage id={question} /> : question}
          </DialogDescription>
        ) : null}
        <DialogFooter className="mt-4 flex justify-end gap-2">
          <Button onClick={onNotConfirm} variant="outline">
            <FormattedMessage id={noTextId} />
          </Button>
          <Button onClick={onConfirm} variant="default">
            <FormattedMessage id={yesTextId} />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ConfirmationDialog }

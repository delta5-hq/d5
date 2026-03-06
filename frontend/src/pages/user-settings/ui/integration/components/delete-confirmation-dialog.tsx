import * as React from 'react'
import { FormattedMessage } from 'react-intl'
import { AlertTriangle } from 'lucide-react'

import { Button } from '@shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog'

interface DeleteConfirmationDialogProps {
  open: boolean
  alias: string
  onConfirm: () => void
  onCancel: () => void
}

export const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
  alias,
  onCancel,
  onConfirm,
  open,
}) => (
  <Dialog onOpenChange={onCancel} open={open}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle aria-hidden="true" className="h-5 w-5 text-destructive" />
          <DialogTitle>
            <FormattedMessage id="dialog.integration.deleteConfirmTitle" />
          </DialogTitle>
        </div>
      </DialogHeader>

      <DialogDescription>
        <FormattedMessage id="dialog.integration.deleteConfirmMessage" values={{ alias }} />
      </DialogDescription>

      <DialogFooter className="flex gap-2 sm:gap-2">
        <Button onClick={onConfirm} variant="danger">
          <FormattedMessage id="delete" />
        </Button>
        <DialogClose asChild>
          <Button variant="default">
            <FormattedMessage id="cancel" />
          </Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)

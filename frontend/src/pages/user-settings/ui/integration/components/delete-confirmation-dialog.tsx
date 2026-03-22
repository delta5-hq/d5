import * as React from 'react'
import { FormattedMessage } from 'react-intl'
import { AlertTriangle } from 'lucide-react'

import { Button } from '@shared/ui/button'
import {
  GlassDialog,
  GlassDialogClose,
  GlassDialogContent,
  GlassDialogDescription,
  GlassDialogFooter,
  GlassDialogHeader,
  GlassDialogTitle,
} from '@shared/ui/glass-dialog'

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
  <GlassDialog onOpenChange={onCancel} open={open}>
    <GlassDialogContent className="max-w-md" dismissible={false}>
      <GlassDialogHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle aria-hidden="true" className="h-5 w-5 text-destructive" />
          <GlassDialogTitle>
            <FormattedMessage id="dialog.integration.deleteConfirmTitle" />
          </GlassDialogTitle>
        </div>
      </GlassDialogHeader>

      <GlassDialogDescription>
        <FormattedMessage id="dialog.integration.deleteConfirmMessage" values={{ alias }} />
      </GlassDialogDescription>

      <GlassDialogFooter className="flex gap-2 sm:gap-2">
        <Button onClick={onConfirm} variant="danger">
          <FormattedMessage id="delete" />
        </Button>
        <GlassDialogClose asChild>
          <Button variant="default">
            <FormattedMessage id="cancel" />
          </Button>
        </GlassDialogClose>
      </GlassDialogFooter>
    </GlassDialogContent>
  </GlassDialog>
)

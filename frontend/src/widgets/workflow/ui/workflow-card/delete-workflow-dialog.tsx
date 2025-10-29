import type { DialogProps } from '@shared/base-types'
import { useApiMutation } from '@shared/composables'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@shared/ui/alert-dialog'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { Label } from '@shared/ui/label'
import React, { useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { toast } from 'sonner'

interface DeleteDialogProps extends DialogProps {
  id: string
  title?: string
}

const DeleteWorkflowDialog: React.FC<DeleteDialogProps> = ({ id, title, open, onClose }) => {
  const [confirmText, setConfirmText] = useState('')
  const { formatMessage } = useIntl()

  const { mutateAsync: deleteWorkflow, isPending: isLoading } = useApiMutation<{ success: boolean }, Error, void>({
    method: 'DELETE',
    url: `/workflow/${id}`,
    onSuccess: () => {
      toast.info(formatMessage({ id: 'workflowDeleteSuccessful' }))
      onClose?.()
    },
    onError: error => toast.error(error.message),
  })

  const isConfirmed = confirmText.trim() === title?.trim()

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="sm:max-w-md flex flex-col gap-y-6">
        <AlertDialogHeader>
          <AlertDialogTitle>
            <FormattedMessage id="deleteWorkflowDialogTitle" />
          </AlertDialogTitle>
          <AlertDialogDescription className="text-link">
            <FormattedMessage id="deleteWorkflowMessage" />
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div>
          <Label className="text-sm text-muted-foreground" htmlFor="confirm">
            <FormattedMessage id="deleteWorkflowWarning" values={{ title }} />
          </Label>
          <Input
            className="w-full"
            id="confirm"
            onChange={e => setConfirmText(e.target.value)}
            placeholder={title}
            value={confirmText}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="default">
              <FormattedMessage id="buttonCancel" />
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild disabled={!isConfirmed || isLoading} onClick={() => deleteWorkflow()}>
            <Button variant="danger">
              <FormattedMessage id="delete" />
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default DeleteWorkflowDialog

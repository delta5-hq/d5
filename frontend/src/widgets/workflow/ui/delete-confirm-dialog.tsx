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
import { FormattedMessage } from 'react-intl'

interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  nodeTitle: string
  descendantCount: number
}

export const DeleteConfirmDialog = ({
  open,
  onOpenChange,
  onConfirm,
  nodeTitle,
  descendantCount,
}: DeleteConfirmDialogProps) => {
  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <FormattedMessage id="workflowTree.deleteDialog.title" />
          </AlertDialogTitle>
          <AlertDialogDescription>
            {descendantCount > 0 ? (
              <FormattedMessage
                id="workflowTree.deleteDialog.descriptionWithChildren"
                values={{
                  title: nodeTitle || <FormattedMessage id="workflowTree.node.untitled" />,
                  count: descendantCount,
                }}
              />
            ) : (
              <FormattedMessage
                id="workflowTree.deleteDialog.description"
                values={{
                  title: nodeTitle || <FormattedMessage id="workflowTree.node.untitled" />,
                }}
              />
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            <FormattedMessage id="cancel" />
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handleConfirm}
          >
            <FormattedMessage id="delete" />
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

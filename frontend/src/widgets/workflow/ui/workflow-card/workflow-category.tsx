import React, { useState, useCallback } from 'react'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/ui/dialog'
import { Input } from '@shared/ui/input'
import { X } from 'lucide-react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useApiMutation } from '@shared/composables'
import type { WorkflowItem } from '@widgets/workflow/model'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { DialogProps } from '@shared/base-types'

interface WorkflowCategoryDialogProps extends DialogProps {
  workflow: WorkflowItem
}

export const WorkflowCategoryDialog: React.FC<WorkflowCategoryDialogProps> = ({ workflow, open, onClose }) => {
  const [category, setCategory] = useState(workflow.category || '')
  const queryClient = useQueryClient()
  const { formatMessage } = useIntl()

  const { mutateAsync: saveCategory } = useApiMutation<{ success: boolean }, Error, { category: string | null }>({
    url: `/workflow/${workflow.workflowId}/category`,
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['workflows'], type: 'active', exact: false })
      onClose?.()
      toast.success(formatMessage({ id: 'categoryCreatedSuccesfully' }))
    },
    onError: error => toast.error(error.message),
  })

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      await saveCategory({ category })
    },
    [saveCategory, category],
  )

  return (
    <Dialog onOpenChange={onClose} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <FormattedMessage id="workflowAddCategoryLabel" />
          </DialogTitle>
        </DialogHeader>

        <form className="space-y-4 mt-4" onSubmit={onSubmit}>
          <Input autoFocus onChange={e => setCategory(e.target.value)} placeholder="Category" value={category} />
          <DialogFooter className="flex justify-end gap-2">
            <Button onClick={onClose} type="button" variant="default">
              <FormattedMessage id="cancel" />
            </Button>
            <Button type="submit">
              <FormattedMessage id="save" />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface WorkflowCategoryButtonProps {
  workflow: WorkflowItem
}

export const WorkflowCategoryButton: React.FC<WorkflowCategoryButtonProps> = ({ workflow }) => {
  const [open, setOpen] = useState(false)
  const { mutateAsync: saveCategory } = useApiMutation<{ success: boolean }, Error, { category: string | null }>({
    url: `/workflow/${workflow.workflowId}/category`,
  })

  const onDelete = useCallback(async () => {
    await saveCategory({ category: null })
  }, [saveCategory])

  return (
    <>
      {workflow.category ? (
        <Button onClick={() => setOpen(true)} size="sm" variant="default">
          {workflow.category}
          <X className="h-4 w-4 ml-1" onClick={onDelete} />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)} size="sm" variant="default">
          <span className="mr-1">+</span>
          <FormattedMessage id="workflowAddCategoryLabel" />
        </Button>
      )}

      <WorkflowCategoryDialog onClose={() => setOpen(false)} open={open} workflow={workflow} />
    </>
  )
}

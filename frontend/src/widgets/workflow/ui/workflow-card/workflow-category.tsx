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

interface WorkflowCategoryProps {
  workflow: WorkflowItem
}

export const WorkflowCategory: React.FC<WorkflowCategoryProps> = ({ workflow }) => {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState(workflow.category || '')
  const queryClient = useQueryClient()
  const { formatMessage } = useIntl()

  const { mutateAsync: saveCategory } = useApiMutation<{ success: boolean }, Error, { category: string | null }>({
    url: `/workflow/${workflow.workflowId}/category`,
    onSuccess: () => {
      queryClient.refetchQueries({
        queryKey: ['workflows'],
        type: 'active',
        exact: false,
      })
      setOpen(false)
      toast.success(formatMessage({ id: 'categoryCreatedSuccesfully' }))
    },
    onError: error => toast.error(error.message),
  })

  const onDelete = useCallback(async () => {
    await saveCategory({ category: null })
    setCategory('')
  }, [saveCategory])

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      await saveCategory({ category })
    },
    [saveCategory, category],
  )

  return (
    <>
      {workflow.category ? (
        <Button onClick={() => setOpen(true)} size="sm" variant="default">
          {workflow.category}

          <X className="h-4 w-4" onClick={onDelete} />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)} size="sm" variant="outline">
          <span className="mr-1">+</span>
          <FormattedMessage id="workflowAddCategoryLabel" />
        </Button>
      )}

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <FormattedMessage id="workflowAddCategoryLabel" />
            </DialogTitle>
            <Button className="absolute right-4 top-4" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </DialogHeader>

          <form className="space-y-4 mt-4" onSubmit={onSubmit}>
            <Input autoFocus onChange={e => setCategory(e.target.value)} placeholder="Category" value={category} />
            <DialogFooter className="flex justify-end gap-2">
              <Button onClick={() => setOpen(false)} type="button" variant="outline">
                <FormattedMessage id="cancel" />
              </Button>
              <Button type="submit">
                <FormattedMessage id="save" />
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

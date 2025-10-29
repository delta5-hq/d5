import { useApiMutation } from '@shared/composables'
import { apiFetch } from '@shared/lib/base-api'
import { toast } from 'sonner'
import type { CreateEmptyWorkflow } from '../model'

export const useWorkflowManage = () => {
  const emptyMutation = useApiMutation<CreateEmptyWorkflow, Error, void>({
    url: '/workflow',
    method: 'POST',
    onError: (e: Error) => {
      toast.error(e.message)
    },
  })

  const fromTemplateMutation = useApiMutation<CreateEmptyWorkflow, Error, { templateId: string }>({
    url: '/workflow',
    method: 'POST',
    onError: (e: Error) => {
      toast.error(e.message)
    },
    mutationFn: ({ templateId }) =>
      apiFetch<CreateEmptyWorkflow>(`/workflow/from/template/${templateId}`, {
        method: 'POST',
      }),
  })

  const isCreating = emptyMutation.isPending || fromTemplateMutation.isPending
  const createError = emptyMutation.error || fromTemplateMutation.error

  return {
    isCreating,
    createError,
    createEmpty: emptyMutation.mutateAsync,
    createFromTemplate: fromTemplateMutation.mutateAsync,
  }
}

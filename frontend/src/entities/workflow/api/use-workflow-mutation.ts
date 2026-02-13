import { useApiMutation } from '@shared/composables'
import type { WorkflowContentData } from '@shared/base-types'
import { toast } from 'sonner'

interface WorkflowUpdatePayload {
  nodes?: Record<string, unknown>
  edges?: Record<string, unknown>
  files?: Record<string, unknown>
  root?: string
}

export const useWorkflowMutation = (workflowId: string) => {
  const mutation = useApiMutation<WorkflowContentData, Error, WorkflowUpdatePayload>({
    url: `/workflow/${workflowId}`,
    method: 'PUT',
    onError: (error: Error) => {
      toast.error(`Failed to save workflow: ${error.message}`)
    },
  })

  return {
    updateWorkflow: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    updateError: mutation.error,
  }
}

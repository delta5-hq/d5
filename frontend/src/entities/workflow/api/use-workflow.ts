import { useApiQuery } from '@shared/composables'
import type { WorkflowContentData } from '@shared/base-types'
import { toast } from 'sonner'

export interface WorkflowResponse extends WorkflowContentData {
  _id: string
  workflowId: string
  userId: string
  createdAt: string
  updatedAt: string
  title?: string
}

export const useWorkflow = (workflowId: string | undefined) => {
  const { data, isLoading, error, refetch } = useApiQuery<WorkflowResponse>({
    queryKey: ['workflow', workflowId],
    url: workflowId ? `/workflow/${workflowId}` : undefined,
    enabled: Boolean(workflowId),
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  return {
    workflow: data,
    nodes: data?.nodes,
    root: data?.root,
    isLoading,
    error,
    refetch,
  }
}

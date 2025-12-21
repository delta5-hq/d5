import { useApiMutation, useApiQuery } from '@shared/composables'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useIntl } from 'react-intl'
import type { PublicShare, WorkflowContentData } from '@shared/base-types'

interface UseShareWorkflowOptions {
  workflowId: string
  enabled?: boolean
}

interface VisibilityState {
  isPublic: boolean
  isHidden: boolean
  isWriteable: boolean
}

export const useShareWorkflow = ({ workflowId, enabled = true }: UseShareWorkflowOptions) => {
  const { formatMessage } = useIntl()
  const queryClient = useQueryClient()

  const { data: workflow, isLoading: isLoadingWorkflow } = useApiQuery<WorkflowContentData>({
    queryKey: ['workflow', workflowId],
    url: `/workflow/${workflowId}`,
    enabled,
  })

  const { mutateAsync: updateVisibility, isPending: isUpdating } = useApiMutation<
    { success: boolean },
    Error,
    Partial<PublicShare>
  >({
    url: `/workflow/${workflowId}/share/public`,
    onSuccess: async () => {
      await queryClient.refetchQueries({
        queryKey: ['workflows'],
        type: 'active',
        exact: false,
      })
      await queryClient.invalidateQueries({
        queryKey: ['workflow', workflowId],
      })
    },
  })

  const currentState: VisibilityState = {
    isPublic: !!workflow?.share?.public?.enabled,
    isHidden: !!workflow?.share?.public?.hidden,
    isWriteable: !!workflow?.share?.public?.writeable,
  }

  const shareUrl = workflowId ? `${window.location.origin}/workflow/${workflowId}` : ''

  const makePublic = async () => {
    try {
      await updateVisibility({ enabled: true, hidden: false })
      toast.success(formatMessage({ id: 'workflowSharedPublicSuccess' }))
    } catch (error) {
      toast.error((error as Error).message)
    }
  }

  const makePrivate = async () => {
    try {
      await updateVisibility({ enabled: false })
      toast.success(formatMessage({ id: 'workflowMadePrivateSuccess' }))
    } catch (error) {
      toast.error((error as Error).message)
    }
  }

  const updateVisibilityOptions = async (options: Partial<PublicShare>) => {
    try {
      await updateVisibility(options)
      toast.success(formatMessage({ id: 'shareSuccessChange' }))
    } catch (error) {
      toast.error((error as Error).message)
    }
  }

  return {
    workflow,
    currentState,
    shareUrl,
    isLoading: isLoadingWorkflow || isUpdating,
    makePublic,
    makePrivate,
    updateVisibility: updateVisibilityOptions,
  }
}

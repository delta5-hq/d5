import type { WorkflowItem } from '@widgets/workflow'
import { useApiQuery } from '@shared/composables'

export const useUserWorkflowsList = () => {
  const { data, isLoading } = useApiQuery<{ data: WorkflowItem[] }>({
    queryKey: ['workflows', 'user-list'],
    url: '/workflow?public=false',
  })

  return {
    workflows: data?.data || [],
    isLoading,
  }
}

import { useApiQuery } from '@shared/composables'

interface WorkflowNodeTitle {
  title?: string
}

interface WorkflowListItem {
  workflowId: string
  title: string
  root: string
  nodes?: Record<string, WorkflowNodeTitle>
}

export interface WorkflowScopeOption {
  workflowId: string
  displayTitle: string
}

export const resolveDisplayTitle = (workflow: WorkflowListItem): string => {
  if (workflow.title.trim()) return workflow.title.trim()
  const rootNode = workflow.root ? workflow.nodes?.[workflow.root] : undefined
  if (rootNode?.title?.trim()) return rootNode.title.trim()
  return workflow.workflowId
}

export const useUserWorkflowsList = () => {
  const { data, isLoading } = useApiQuery<{ data: WorkflowListItem[] }>({
    queryKey: ['workflows', 'user-list'],
    url: '/workflow?public=false',
  })

  const workflows: WorkflowScopeOption[] = (data?.data ?? []).map(w => ({
    workflowId: w.workflowId,
    displayTitle: resolveDisplayTitle(w),
  }))

  return { workflows, isLoading }
}

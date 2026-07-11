import { useApiQuery } from '@shared/composables'
import { queryKeys } from '@shared/config'
import type { IntegrationSettings } from '@shared/base-types'

interface ScopedIntegrationsResult {
  currentScopeData: IntegrationSettings | undefined
  appWideScopeData: IntegrationSettings | undefined
  isLoading: boolean
  refetch: () => Promise<void>
}

/**
 * Fetches integration data for the current scope and optionally app-wide scope.
 * When workflowId is provided, fetches both workflow-scoped and app-wide data.
 * When workflowId is null, fetches only app-wide data.
 */
export function useScopedIntegrations(workflowId: string | null): ScopedIntegrationsResult {
  const hasWorkflowScope = workflowId !== null
  const workflowParam = hasWorkflowScope ? `?workflowId=${workflowId}` : ''

  const currentScopeQuery = useApiQuery<IntegrationSettings>({
    queryKey: [...queryKeys.integration, workflowId],
    url: `/integration${workflowParam}`,
  })

  const appWideScopeQuery = useApiQuery<IntegrationSettings>({
    queryKey: [...queryKeys.integration, 'app-wide'],
    url: `/integration`,
    enabled: hasWorkflowScope,
  })

  const refetch = async () => {
    await currentScopeQuery.refetch()
    if (hasWorkflowScope) {
      await appWideScopeQuery.refetch()
    }
  }

  return {
    currentScopeData: currentScopeQuery.data,
    appWideScopeData: hasWorkflowScope ? appWideScopeQuery.data : undefined,
    isLoading: currentScopeQuery.isLoading || appWideScopeQuery.isLoading,
    refetch,
  }
}

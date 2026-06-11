import { useApiQuery } from './use-api-query'
import { queryKeys } from '@shared/config'
import type { IntegrationSettings } from '@shared/base-types'

export function useIntegrationSettings(workflowId: string | undefined): IntegrationSettings | undefined {
  const url = workflowId ? `/integration?workflowId=${workflowId}` : '/integration'
  const query = useApiQuery<IntegrationSettings>({
    queryKey: [...queryKeys.integration, workflowId ?? 'app-wide'],
    url,
  })
  return query.data
}

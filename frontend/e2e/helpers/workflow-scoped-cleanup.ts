import type { Page } from '@playwright/test'

export interface ScopeDescriptor {
  label: string
  workflowId: string | undefined
}

export async function cleanAllIntegrationsAcrossScopes(page: Page, scopes: ScopeDescriptor[]) {
  const llmServices = ['openai', 'deepseek', 'qwen', 'claude', 'perplexity', 'yandex', 'custom_llm']

  for (const scope of scopes) {
    const queryParam = scope.workflowId ? `?workflowId=${scope.workflowId}` : ''

    for (const service of llmServices) {
      await page.evaluate(
        async ({ svc, param }) => {
          await fetch(`/api/v2/integration/${svc}/delete${param}`, { method: 'DELETE' }).catch(() => {})
        },
        { svc: service, param: queryParam },
      )
    }

    const integrationResponse = await page.request.get(`/api/v2/integration${queryParam}`)
    const integrationData = await integrationResponse.json()

    if (integrationData.mcp?.length) {
      for (const item of integrationData.mcp) {
        await page.request.delete(`/api/v2/integration/mcp/items/${encodeURIComponent(item.alias)}${queryParam}`)
      }
    }

    if (integrationData.rpc?.length) {
      for (const item of integrationData.rpc) {
        await page.request.delete(`/api/v2/integration/rpc/items/${encodeURIComponent(item.alias)}${queryParam}`)
      }
    }
  }
}

export async function getIntegrationAtScope(page: Page, workflowId?: string) {
  const queryParam = workflowId ? `?workflowId=${workflowId}` : ''
  const response = await page.request.get(`/api/v2/integration${queryParam}`)
  return response.json()
}

export async function addMCPItemAtScope(
  page: Page,
  item: Record<string, unknown>,
  workflowId?: string,
): Promise<{ ok: boolean; status: number }> {
  const queryParam = workflowId ? `?workflowId=${workflowId}` : ''
  const response = await page.request.post(`/api/v2/integration/mcp/items${queryParam}`, { data: item })
  return { ok: response.ok(), status: response.status() }
}

export async function addRPCItemAtScope(
  page: Page,
  item: Record<string, unknown>,
  workflowId?: string,
): Promise<{ ok: boolean; status: number }> {
  const queryParam = workflowId ? `?workflowId=${workflowId}` : ''
  const response = await page.request.post(`/api/v2/integration/rpc/items${queryParam}`, { data: item })
  return { ok: response.ok(), status: response.status() }
}

export async function deleteMCPItemAtScope(page: Page, alias: string, workflowId?: string) {
  const queryParam = workflowId ? `?workflowId=${workflowId}` : ''
  return page.request.delete(`/api/v2/integration/mcp/items/${encodeURIComponent(alias)}${queryParam}`)
}

export async function deleteRPCItemAtScope(page: Page, alias: string, workflowId?: string) {
  const queryParam = workflowId ? `?workflowId=${workflowId}` : ''
  return page.request.delete(`/api/v2/integration/rpc/items/${encodeURIComponent(alias)}${queryParam}`)
}

export async function updateLLMServiceAtScope(
  page: Page,
  service: string,
  data: Record<string, unknown>,
  workflowId?: string,
) {
  const queryParam = workflowId ? `?workflowId=${workflowId}` : ''
  return page.request.put(`/api/v2/integration/${service}/update${queryParam}`, { data })
}

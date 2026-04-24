import type { Page } from '@playwright/test'

export interface ScopeDescriptor {
  label: string
  workflowId: string | undefined
}

async function fetchIntegrationWithAuthRetry(page: Page, queryParam: string): Promise<any> {
  for (let i = 0; i < 5; i++) {
    const response = await page.request.get(`/api/v2/integration${queryParam}`)
    if (response.ok()) return response.json()
    if (response.status() !== 401) return {}
    await page.waitForTimeout(300)
  }
  return {}
}

export async function cleanAllIntegrationsAcrossScopes(page: Page, scopes: ScopeDescriptor[]) {
  const llmServices = ['openai', 'deepseek', 'qwen', 'claude', 'perplexity', 'yandex', 'custom_llm']

  for (const scope of scopes) {
    const queryParam = scope.workflowId ? `?workflowId=${scope.workflowId}` : ''

    for (const service of llmServices) {
      await page.request.delete(`/api/v2/integration/${service}/delete${queryParam}`).catch(() => {})
    }

    const integrationData = await fetchIntegrationWithAuthRetry(page, queryParam)

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

    const verify = await fetchIntegrationWithAuthRetry(page, queryParam)
    if (verify.mcp?.length || verify.rpc?.length) {
      if (verify.mcp?.length) {
        for (const item of verify.mcp) {
          await page.request
            .delete(`/api/v2/integration/mcp/items/${encodeURIComponent(item.alias)}${queryParam}`)
            .catch(() => {})
        }
      }
      if (verify.rpc?.length) {
        for (const item of verify.rpc) {
          await page.request
            .delete(`/api/v2/integration/rpc/items/${encodeURIComponent(item.alias)}${queryParam}`)
            .catch(() => {})
        }
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

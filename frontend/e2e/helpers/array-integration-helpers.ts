import type { Page } from '@playwright/test'

export async function cleanArrayIntegrations(page: Page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const integration = await page.evaluate(async () => {
      for (let i = 0; i < 5; i++) {
        const r = await fetch('/api/v2/integration', { credentials: 'include' })
        if (r.ok) return r.json()
        if (r.status !== 401) throw new Error(`GET /api/v2/integration failed with status ${r.status}`)
        await new Promise(res => setTimeout(res, 300))
      }
      throw new Error('GET /api/v2/integration failed with 401 after 5 attempts (auth cookie not applied)')
    })

    const hasMcp = integration.mcp?.length > 0
    const hasRpc = integration.rpc?.length > 0

    if (!hasMcp && !hasRpc) return

    if (hasMcp) {
      for (const item of integration.mcp) {
        const status = await page.evaluate(
          async alias => {
            const r = await fetch(`/api/v2/integration/mcp/items/${encodeURIComponent(alias)}`, {
              method: 'DELETE',
              credentials: 'include',
            })
            return { ok: r.ok, status: r.status }
          },
          item.alias,
        )
        if (!status.ok) {
          throw new Error(`DELETE mcp/${item.alias} failed with status ${status.status}`)
        }
      }
    }

    if (hasRpc) {
      for (const item of integration.rpc) {
        const status = await page.evaluate(
          async alias => {
            const r = await fetch(`/api/v2/integration/rpc/items/${encodeURIComponent(alias)}`, {
              method: 'DELETE',
              credentials: 'include',
            })
            return { ok: r.ok, status: r.status }
          },
          item.alias,
        )
        if (!status.ok) {
          throw new Error(`DELETE rpc/${item.alias} failed with status ${status.status}`)
        }
      }
    }

    const verifyClean = await page.evaluate(async () => {
      for (let i = 0; i < 5; i++) {
        const r = await fetch('/api/v2/integration', { credentials: 'include' })
        if (r.ok) return r.json()
        if (r.status !== 401) return { mcp: [], rpc: [] }
        await new Promise(res => setTimeout(res, 300))
      }
      return { mcp: [], rpc: [] }
    })

    if (!verifyClean.mcp?.length && !verifyClean.rpc?.length) return
  }

  throw new Error('cleanArrayIntegrations: Failed to clean after 3 attempts')
}

export async function addArrayItem(page: Page, fieldName: string, item: Record<string, unknown>) {
  return page.evaluate(
    ({ field, data }) =>
      fetch(`/api/v2/integration/${field}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      }).then(r => ({ ok: r.ok, status: r.status })),
    { field: fieldName, data: item },
  )
}

export async function updateArrayItem(page: Page, fieldName: string, alias: string, updates: Record<string, unknown>) {
  return page.evaluate(
    ({ field, itemAlias, data }) =>
      fetch(`/api/v2/integration/${field}/items/${encodeURIComponent(itemAlias)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      }).then(r => ({ ok: r.ok, status: r.status })),
    { field: fieldName, itemAlias: alias, data: updates },
  )
}

export async function deleteArrayItem(page: Page, fieldName: string, alias: string) {
  return page.evaluate(
    ({ field, itemAlias }) =>
      fetch(`/api/v2/integration/${field}/items/${encodeURIComponent(itemAlias)}`, {
        method: 'DELETE',
        credentials: 'include',
      }).then(r => ({ ok: r.ok, status: r.status })),
    { field: fieldName, itemAlias: alias },
  )
}

export async function getIntegration(page: Page) {
  return page.evaluate(() => fetch('/api/v2/integration', { credentials: 'include' }).then(r => r.json()))
}

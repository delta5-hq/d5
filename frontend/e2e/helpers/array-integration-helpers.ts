import type { Page } from '@playwright/test'

export async function cleanArrayIntegrations(page: Page) {
  const integration = await page.evaluate(async () => {
    const r = await fetch('/api/v2/integration', { credentials: 'include' })
    if (!r.ok) return {}
    return r.json()
  })

  if (integration.mcp) {
    for (const item of integration.mcp) {
      await page.evaluate(
        alias =>
          fetch(`/api/v2/integration/mcp/items/${encodeURIComponent(alias)}`, {
            method: 'DELETE',
            credentials: 'include',
          }),
        item.alias,
      )
    }
  }

  if (integration.rpc) {
    for (const item of integration.rpc) {
      await page.evaluate(
        alias =>
          fetch(`/api/v2/integration/rpc/items/${encodeURIComponent(alias)}`, {
            method: 'DELETE',
            credentials: 'include',
          }),
        item.alias,
      )
    }
  }
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

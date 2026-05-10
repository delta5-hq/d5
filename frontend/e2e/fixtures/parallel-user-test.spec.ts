import { expect } from '@playwright/test'

import { createParallelUserTest } from './parallel-user-test'

const test = createParallelUserTest('parallel-user-fixture-spec')

const ADMIN_ROLE = 'administrator'
const ISOLATION_ALIAS_PREFIX = '/pw-fixture-isolation'

test.describe.configure({ mode: 'serial' })

test.describe('createParallelUserTest', () => {
  test('session is pre-established — protected API returns 200 without explicit login', async ({ page }) => {
    const response = await page.request.get('/api/v2/integration')
    expect(response.ok()).toBe(true)
  })

  test('parallelIndex 0 maps to administrator role, all other indices map to non-administrator', async ({
    page,
  }, testInfo) => {
    const response = await page.request.get('/api/v2/users/current')
    expect(response.ok()).toBe(true)

    const user: { id: string; mail: string; roles: string[] } = await response.json()
    expect(user.id).toBeTruthy()
    expect(user.mail).toContain('@')

    if (testInfo.parallelIndex === 0) {
      expect(user.roles).toContain(ADMIN_ROLE)
    } else {
      expect(user.roles).not.toContain(ADMIN_ROLE)
    }
  })

  test("integration data is scoped to the authenticated user — parallel workers cannot observe each other's writes", async ({
    page,
  }, testInfo) => {
    const alias = `${ISOLATION_ALIAS_PREFIX}-${testInfo.parallelIndex}`
    const otherWorkerAlias = `${ISOLATION_ALIAS_PREFIX}-${testInfo.parallelIndex === 0 ? 1 : 0}`

    await page.request.delete(`/api/v2/integration/mcp/items/${encodeURIComponent(alias)}`)

    const writeResponse = await page.request.post('/api/v2/integration/mcp/items', {
      data: { alias, transport: 'stdio', toolName: 'echo', command: 'node' },
    })
    expect(writeResponse.status()).toBe(201)

    const readResponse = await page.request.get('/api/v2/integration')
    const integration: { mcp: { alias: string }[] } = await readResponse.json()
    const aliases = (integration.mcp ?? []).map(item => item.alias)

    expect(aliases).toContain(alias)
    expect(aliases).not.toContain(otherWorkerAlias)

    await page.request.delete(`/api/v2/integration/mcp/items/${encodeURIComponent(alias)}`)
  })

  test('session persists across multiple sequential requests without re-authentication', async ({ page }) => {
    const calls = [
      page.request.get('/api/v2/integration'),
      page.request.get('/api/v2/users/current'),
      page.request.get('/api/v2/integration'),
    ]
    const responses = await Promise.all(calls)
    for (const response of responses) {
      expect(response.ok()).toBe(true)
    }
  })
})

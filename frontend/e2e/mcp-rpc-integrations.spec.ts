import { expect, test as base } from '@playwright/test'
import { adminLogin, subscriberLogin } from './utils'
import * as path from 'path'
import * as fs from 'fs'
import {
  addArrayItem,
  cleanArrayIntegrations,
  deleteArrayItem,
  getIntegration,
  updateArrayItem,
} from './helpers/array-integration-helpers'

const test = base.extend<{}, { workerStorageState: string }>({
  storageState: ({ workerStorageState }, use) => use(workerStorageState),
  workerStorageState: [
    async ({ browser }, use, workerInfo) => {
      const id = workerInfo.parallelIndex
      const dir = path.resolve(process.cwd(), 'playwright/.auth')

      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

      const fileName = path.join(dir, `mcp-rpc-user.${id}.json`)
      const page = await browser.newPage({
        baseURL: workerInfo.project.use.baseURL,
      })

      // Use a different user per worker to isolate integration documents in MongoDB.
      // Both browsers (chromium=0, firefox=1) run the serial suite concurrently; giving
      // each its own user prevents race conditions on POST /integration/:field/items.
      if (workerInfo.parallelIndex === 0) {
        await adminLogin(page)
      } else {
        await subscriberLogin(page)
      }

      await page.context().storageState({ path: fileName })
      await page.close()

      await use(fileName)
    },
    { scope: 'worker' },
  ],
})

test.describe.serial('Array Integration CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await cleanArrayIntegrations(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('Add single item creates it in array', async ({ page }) => {
    const response = await addArrayItem(page, 'mcp', {
      alias: '/research',
      transport: 'stdio',
      toolName: 'auto',
      command: 'npx',
      args: ['-y', '@mcp/server-research'],
      description: 'Research assistant',
    })

    expect(response.ok).toBe(true)
    expect(response.status).toBe(201)

    const integration = await getIntegration(page)
    expect(integration.mcp).toHaveLength(1)
    expect(integration.mcp[0].alias).toBe('/research')
    expect(integration.mcp[0].toolName).toBe('auto')
  })

  test('Add duplicate alias within same field returns 400', async ({ page }) => {
    const item = { alias: '/duplicate', transport: 'stdio', toolName: 'test' }

    const first = await addArrayItem(page, 'mcp', item)
    expect(first.ok).toBe(true)

    const second = await addArrayItem(page, 'mcp', item)
    expect(second.ok).toBe(false)
    expect(second.status).toBe(400)
  })

  test('Add multiple items with different aliases succeeds', async ({ page }) => {
    await addArrayItem(page, 'mcp', { alias: '/item1', transport: 'stdio', toolName: 'tool1' })
    await addArrayItem(page, 'mcp', {
      alias: '/item2',
      transport: 'streamable-http',
      toolName: 'tool2',
      serverUrl: 'http://localhost:3100',
    })
    await addArrayItem(page, 'mcp', { alias: '/item3', transport: 'stdio', toolName: 'tool3' })

    const integration = await getIntegration(page)
    expect(integration.mcp).toHaveLength(3)

    const aliases = integration.mcp.map((i: { alias: string }) => i.alias).sort()
    expect(aliases).toEqual(['/item1', '/item2', '/item3'])
  })

  test('Update item modifies only target item', async ({ page }) => {
    await addArrayItem(page, 'mcp', {
      alias: '/keep1',
      transport: 'stdio',
      toolName: 'original1',
      description: 'desc1',
    })
    await addArrayItem(page, 'mcp', {
      alias: '/update',
      transport: 'stdio',
      toolName: 'original2',
      description: 'desc2',
    })
    await addArrayItem(page, 'mcp', {
      alias: '/keep2',
      transport: 'stdio',
      toolName: 'original3',
      description: 'desc3',
    })

    const response = await updateArrayItem(page, 'mcp', '/update', { description: 'updated description' })
    expect(response.ok).toBe(true)

    const integration = await getIntegration(page)
    expect(integration.mcp).toHaveLength(3)

    const keep1 = integration.mcp.find((i: { alias: string }) => i.alias === '/keep1')
    const updated = integration.mcp.find((i: { alias: string }) => i.alias === '/update')
    const keep2 = integration.mcp.find((i: { alias: string }) => i.alias === '/keep2')

    expect(keep1.description).toBe('desc1')
    expect(keep2.description).toBe('desc3')
    expect(updated.description).toBe('updated description')
    expect(updated.toolName).toBe('original2')
  })

  test('Update non-existent item returns 404', async ({ page }) => {
    const response = await updateArrayItem(page, 'mcp', '/nonexistent', { description: 'test' })
    expect(response.ok).toBe(false)
    expect(response.status).toBe(404)
  })

  test('Delete item removes only target item', async ({ page }) => {
    await addArrayItem(page, 'mcp', { alias: '/keep1', transport: 'stdio', toolName: 'tool1' })
    await addArrayItem(page, 'mcp', { alias: '/delete', transport: 'stdio', toolName: 'tool2' })
    await addArrayItem(page, 'mcp', { alias: '/keep2', transport: 'stdio', toolName: 'tool3' })

    const response = await deleteArrayItem(page, 'mcp', '/delete')
    expect(response.ok).toBe(true)
    expect(response.status).toBe(204)

    const integration = await getIntegration(page)
    expect(integration.mcp).toHaveLength(2)

    const aliases = integration.mcp.map((i: { alias: string }) => i.alias).sort()
    expect(aliases).toEqual(['/keep1', '/keep2'])
  })

  test('Delete non-existent item is idempotent', async ({ page }) => {
    const response = await deleteArrayItem(page, 'mcp', '/nonexistent')
    expect(response.status).toBe(204)
  })

  test('Delete same item twice returns 204 both times', async ({ page }) => {
    await addArrayItem(page, 'mcp', { alias: '/temp', transport: 'stdio', toolName: 'tool' })

    const firstDelete = await deleteArrayItem(page, 'mcp', '/temp')
    expect(firstDelete.status).toBe(204)

    const secondDelete = await deleteArrayItem(page, 'mcp', '/temp')
    expect(secondDelete.status).toBe(204)
  })

  test('Delete last item removes integration document', async ({ page }) => {
    await addArrayItem(page, 'mcp', { alias: '/only', transport: 'stdio', toolName: 'tool' })

    await deleteArrayItem(page, 'mcp', '/only')

    const integration = await getIntegration(page)
    expect(integration.mcp).toBeUndefined()
  })

  test('Delete all items leaves empty array', async ({ page }) => {
    await addArrayItem(page, 'mcp', { alias: '/item1', transport: 'stdio', toolName: 'tool1' })
    await addArrayItem(page, 'mcp', { alias: '/item2', transport: 'stdio', toolName: 'tool2' })

    await deleteArrayItem(page, 'mcp', '/item1')
    await deleteArrayItem(page, 'mcp', '/item2')

    await expect
      .poll(
        async () => {
          const integration = await getIntegration(page)
          return (integration.mcp || []).length
        },
        { timeout: 5000, intervals: [200, 500, 1000] },
      )
      .toBe(0)
  })

  test('RPC SSH protocol with all fields', async ({ page }) => {
    const response = await addArrayItem(page, 'rpc', {
      alias: '/coder1',
      protocol: 'ssh',
      host: '192.168.1.100',
      port: 22,
      username: 'developer',
      privateKey: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
      commandTemplate: 'claude -p "{{prompt}}" --output-format json',
      description: 'Development VM',
      outputFormat: 'json',
      outputField: 'output',
      sessionIdField: 'session_id',
      timeoutMs: 300000,
    })

    expect(response.ok).toBe(true)

    const integration = await getIntegration(page)
    expect(integration.rpc).toHaveLength(1)
    expect(integration.rpc[0].alias).toBe('/coder1')
    expect(integration.rpc[0].protocol).toBe('ssh')
    expect(integration.rpc[0].host).toBe('192.168.1.100')
  })

  test('RPC HTTP protocol', async ({ page }) => {
    const response = await addArrayItem(page, 'rpc', {
      alias: '/webhook',
      protocol: 'http',
      url: 'https://api.example.com/execute',
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
      bodyTemplate: '{"query":"{{prompt}}"}',
      outputFormat: 'json',
      outputField: 'result',
    })

    expect(response.ok).toBe(true)

    const integration = await getIntegration(page)
    expect(integration.rpc[0].protocol).toBe('http')
    expect(integration.rpc[0].url).toBe('https://api.example.com/execute')
  })

  test('RPC ACP local protocol', async ({ page }) => {
    const response = await addArrayItem(page, 'rpc', {
      alias: '/cline',
      protocol: 'acp-local',
      command: 'cline',
      args: ['--acp'],
      env: { API_KEY: 'test' },
      autoApprove: 'whitelist',
      allowedTools: ['read_file', 'write_file'],
      timeoutMs: 600000,
    })

    expect(response.ok).toBe(true)

    const integration = await getIntegration(page)
    expect(integration.rpc[0].protocol).toBe('acp-local')
    expect(integration.rpc[0].command).toBe('cline')
    expect(integration.rpc[0].autoApprove).toBe('whitelist')
  })

  test('Adding duplicate alias across field types returns 400 (MCP first)', async ({ page }) => {
    const first = await addArrayItem(page, 'mcp', { alias: '/shared', transport: 'stdio', toolName: 'mcp_tool' })
    expect(first.ok).toBe(true)

    const second = await addArrayItem(page, 'rpc', { alias: '/shared', protocol: 'ssh', host: '127.0.0.1' })
    expect(second.ok).toBe(false)
    expect(second.status).toBe(400)

    const integration = await getIntegration(page)
    expect(integration.mcp).toHaveLength(1)
    expect(integration.rpc || []).toHaveLength(0)
  })

  test('Adding duplicate alias across field types returns 400 (RPC first)', async ({ page }) => {
    const first = await addArrayItem(page, 'rpc', { alias: '/shared', protocol: 'ssh', host: '127.0.0.1' })
    expect(first.ok).toBe(true)

    const second = await addArrayItem(page, 'mcp', { alias: '/shared', transport: 'stdio', toolName: 'mcp_tool' })
    expect(second.ok).toBe(false)
    expect(second.status).toBe(400)

    const integration = await getIntegration(page)
    expect(integration.rpc).toHaveLength(1)
    expect(integration.mcp || []).toHaveLength(0)
  })

  test('Add in one field does not affect other field', async ({ page }) => {
    await addArrayItem(page, 'mcp', { alias: '/mcp-first', transport: 'stdio', toolName: 'test' })
    await addArrayItem(page, 'rpc', { alias: '/rpc-second', protocol: 'ssh', host: '127.0.0.1' })

    const integration = await getIntegration(page)
    expect(integration.mcp).toHaveLength(1)
    expect(integration.mcp[0].alias).toBe('/mcp-first')
    expect(integration.rpc).toHaveLength(1)
    expect(integration.rpc[0].alias).toBe('/rpc-second')
  })

  test('Update in one field does not affect other field', async ({ page }) => {
    await addArrayItem(page, 'mcp', { alias: '/mcp1', transport: 'stdio', toolName: 'test' })
    await addArrayItem(page, 'rpc', { alias: '/rpc1', protocol: 'ssh', host: '127.0.0.1' })

    await updateArrayItem(page, 'mcp', '/mcp1', { description: 'updated' })

    const integration = await getIntegration(page)
    expect(integration.rpc).toHaveLength(1)
    expect(integration.rpc[0].alias).toBe('/rpc1')
    expect(integration.mcp[0].description).toBe('updated')
  })

  test('Delete in one field does not affect other field', async ({ page }) => {
    await addArrayItem(page, 'mcp', { alias: '/mcp-delete', transport: 'stdio', toolName: 'test' })
    await addArrayItem(page, 'rpc', { alias: '/rpc-keep', protocol: 'ssh', host: '127.0.0.1' })

    await deleteArrayItem(page, 'mcp', '/mcp-delete')

    const integration = await getIntegration(page)
    expect(integration.mcp || []).toHaveLength(0)
    expect(integration.rpc).toHaveLength(1)
    expect(integration.rpc[0].alias).toBe('/rpc-keep')
  })

  test('Alias with special characters URL-encodes correctly', async ({ page }) => {
    const alias = '/test/nested'

    const add = await addArrayItem(page, 'mcp', { alias, transport: 'stdio', toolName: 'test' })
    expect(add.ok).toBe(true)

    const del = await deleteArrayItem(page, 'mcp', alias)
    expect(del.status).toBe(204)

    const integration = await getIntegration(page)
    expect(integration.mcp || []).toHaveLength(0)
  })

  test('Invalid field name returns 400', async ({ page }) => {
    const response = await addArrayItem(page, 'invalid', { alias: '/test', toolName: 'test' })
    expect(response.status).toBe(400)
  })

  test('Missing alias field returns 400', async ({ page }) => {
    const response = await addArrayItem(page, 'mcp', { transport: 'stdio', toolName: 'test' })
    expect(response.status).toBe(400)
  })

  test('Empty alias returns 400', async ({ page }) => {
    const response = await addArrayItem(page, 'mcp', { alias: '', transport: 'stdio', toolName: 'test' })
    expect(response.status).toBe(400)
  })

  test('Partial update preserves unmodified fields', async ({ page }) => {
    await addArrayItem(page, 'mcp', {
      alias: '/test',
      transport: 'stdio',
      toolName: 'original',
      description: 'original desc',
      command: 'npx',
    })

    await updateArrayItem(page, 'mcp', '/test', { description: 'new desc' })

    const integration = await getIntegration(page)
    const item = integration.mcp[0]
    expect(item.description).toBe('new desc')
    expect(item.toolName).toBe('original')
    expect(item.command).toBe('npx')
  })

  test('HTTP RPC with headers object stores and retrieves correctly', async ({ page }) => {
    const headers = {
      Authorization: 'Bearer secret-token',
      'Content-Type': 'application/json',
      'X-Custom-Header': 'value with spaces',
    }

    await addArrayItem(page, 'rpc', {
      alias: '/api',
      protocol: 'http',
      url: 'https://example.com/api',
      method: 'POST',
      headers,
    })

    const integration = await getIntegration(page)
    expect(integration.rpc[0].headers).toEqual({ '***': '***' })
    expect(integration.secretsMeta?.rpc?.['/api']?.headers).toBe(true)
  })

  test('Update HTTP RPC headers preserves other fields', async ({ page }) => {
    await addArrayItem(page, 'rpc', {
      alias: '/api',
      protocol: 'http',
      url: 'https://example.com/api',
      method: 'POST',
      headers: { 'X-Old': 'old-value' },
      bodyTemplate: '{"data":"{{prompt}}"}',
    })

    await updateArrayItem(page, 'rpc', '/api', {
      headers: { 'X-New': 'new-value' },
    })

    const integration = await getIntegration(page)
    const item = integration.rpc[0]
    expect(item.headers).toEqual({ '***': '***' })
    expect(integration.secretsMeta?.rpc?.['/api']?.headers).toBe(true)
    expect(item.bodyTemplate).toBe('{"data":"{{prompt}}"}')
    expect(item.method).toBe('POST')
  })

  test('Empty array fields return empty arrays not undefined', async ({ page }) => {
    const integration = await getIntegration(page)
    expect(integration.mcp || []).toEqual([])
    expect(integration.rpc || []).toEqual([])
  })

  test('RPC SSH encrypted fields are redacted on read', async ({ page }) => {
    const response = await addArrayItem(page, 'rpc', {
      alias: '/ssh-secrets',
      protocol: 'ssh',
      host: '192.168.1.10',
      username: 'testuser',
      privateKey: '-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----',
      passphrase: 'secret-passphrase',
      commandTemplate: 'echo test',
    })

    expect(response.ok).toBe(true)

    const integration = await getIntegration(page)
    const item = integration.rpc.find((i: { alias: string }) => i.alias === '/ssh-secrets')

    expect(item.privateKey).toBe('***')
    expect(item.passphrase).toBe('***')
    expect(integration.secretsMeta?.rpc?.['/ssh-secrets']?.privateKey).toBe(true)
    expect(integration.secretsMeta?.rpc?.['/ssh-secrets']?.passphrase).toBe(true)
  })

  test('RPC ACP encrypted env map is redacted on read', async ({ page }) => {
    const response = await addArrayItem(page, 'rpc', {
      alias: '/acp-secrets',
      protocol: 'acp-local',
      command: 'cline',
      env: { API_KEY: 'secret-key', TOKEN: 'secret-token' },
    })

    expect(response.ok).toBe(true)

    const integration = await getIntegration(page)
    const item = integration.rpc.find((i: { alias: string }) => i.alias === '/acp-secrets')

    expect(item.env).toEqual({ '***': '***' })
    expect(integration.secretsMeta?.rpc?.['/acp-secrets']?.env).toBe(true)
  })

  test('MCP encrypted headers map is redacted on read', async ({ page }) => {
    const response = await addArrayItem(page, 'mcp', {
      alias: '/mcp-headers',
      transport: 'streamable-http',
      toolName: 'test',
      serverUrl: 'http://localhost:3100',
      headers: { Authorization: 'Bearer secret', 'X-Key': 'secret-key' },
    })

    expect(response.ok).toBe(true)

    const integration = await getIntegration(page)
    const item = integration.mcp.find((i: { alias: string }) => i.alias === '/mcp-headers')

    expect(item.headers).toEqual({ '***': '***' })
    expect(integration.secretsMeta?.mcp?.['/mcp-headers']?.headers).toBe(true)
  })

  test('MCP encrypted env map is redacted on read', async ({ page }) => {
    const response = await addArrayItem(page, 'mcp', {
      alias: '/mcp-env',
      transport: 'stdio',
      toolName: 'test',
      command: 'node',
      env: { DB_PASSWORD: 'secret-pass', API_KEY: 'secret-key' },
    })

    expect(response.ok).toBe(true)

    const integration = await getIntegration(page)
    const item = integration.mcp.find((i: { alias: string }) => i.alias === '/mcp-env')

    expect(item.env).toEqual({ '***': '***' })
    expect(integration.secretsMeta?.mcp?.['/mcp-env']?.env).toBe(true)
  })
})

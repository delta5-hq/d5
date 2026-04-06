import { expect, test as base } from '@playwright/test'
import { e2eEnv } from './utils/e2e-env-vars'
import path from 'path'
import * as fs from 'fs'
import {
  cleanAllIntegrationsAcrossScopes,
  getIntegrationAtScope,
  addMCPItemAtScope,
  addRPCItemAtScope,
  deleteMCPItemAtScope,
  deleteRPCItemAtScope,
  type ScopeDescriptor,
} from './helpers/workflow-scoped-cleanup'
import { ArrayIntegrationPage } from './pages/ArrayIntegrationPage'
import { TIMEOUTS } from './config/test-timeouts'
import { authenticateViaAPI } from './helpers/api-auth'
import { adminLogin } from './utils'
import { selectWorkflowScope } from './helpers/wait-helpers'

const test = base.extend<{}, { workerStorageState: string }>({
  storageState: ({ workerStorageState }, use) => use(workerStorageState),
  workerStorageState: [
    async ({ browser }, use, workerInfo) => {
      const id = workerInfo.parallelIndex
      const dir = path.resolve(process.cwd(), 'playwright/.auth')

      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

      const fileName = path.join(dir, `workflow-scoped-user.${id}.json`)
      const context = await browser.newContext({
        storageState: undefined,
        baseURL: workerInfo.project.use.baseURL,
      })
      const page = await context.newPage()

      await adminLogin(page)

      await context.storageState({ path: fileName })
      await context.close()

      await use(fileName)
    },
    { scope: 'worker' },
  ],
})

test.describe.serial('Workflow-scoped integrations', () => {
  let workflow1Id: string
  let workflow2Id: string

  test.beforeAll(async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      storageState: undefined,
      baseURL: testInfo.project.use.baseURL,
    })
    const page = await context.newPage()

    const authResult = await authenticateViaAPI(page.request, {
      usernameOrEmail: e2eEnv.E2E_ADMIN_USER,
      password: e2eEnv.E2E_ADMIN_PASS,
    })

    if (!authResult.ok) {
      throw new Error(authResult.error || `Auth failed: ${authResult.status}`)
    }

    const response1 = await page.request.post('/api/v2/workflow', {
      data: { title: 'Test Workflow 1' },
    })
    workflow1Id = (await response1.json()).workflowId

    const response2 = await page.request.post('/api/v2/workflow', {
      data: { title: 'Test Workflow 2' },
    })
    workflow2Id = (await response2.json()).workflowId

    await context.close()
  })

  test.afterAll(async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      storageState: undefined,
      baseURL: testInfo.project.use.baseURL,
    })
    const page = await context.newPage()

    const authResult = await authenticateViaAPI(page.request, {
      usernameOrEmail: e2eEnv.E2E_ADMIN_USER,
      password: e2eEnv.E2E_ADMIN_PASS,
    })

    if (!authResult.ok) {
      throw new Error(authResult.error || `Auth failed: ${authResult.status}`)
    }

    await page.request.delete(`/api/v2/workflow/${workflow1Id}`)
    await page.request.delete(`/api/v2/workflow/${workflow2Id}`)

    await context.close()
  })

  async function ensureIntegrationsTabActive(page: any) {
    const integrationsTab = page.locator('[role="tab"]:has-text("Integrations")')
    if ((await integrationsTab.count()) > 0) {
      await integrationsTab.click()
      await page.waitForTimeout(TIMEOUTS.SIDEBAR_TRANSITION)
    }
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await ensureIntegrationsTabActive(page)

    const scopes: ScopeDescriptor[] = [
      { label: 'user-level', workflowId: undefined },
      { label: 'workflow1', workflowId: workflow1Id },
      { label: 'workflow2', workflowId: workflow2Id },
    ]

    await cleanAllIntegrationsAcrossScopes(page, scopes)
  })

  test('workflow selector is visible on integrations page', async ({ page }) => {
    await page.goto('/settings')
    await ensureIntegrationsTabActive(page)
    await page.waitForSelector('[data-type="workflow-scope-selector"]', { state: 'visible' })

    const selector = page.locator('[data-type="workflow-scope-selector"]')
    await expect(selector).toBeVisible()
  })

  test('workflow selector shows user-level as default', async ({ page }) => {
    await page.goto('/settings')
    await ensureIntegrationsTabActive(page)
    const selector = page.locator('[data-type="workflow-scope-selector"]')
    await expect(selector).toContainText(/All workflows|user-level/i)
  })

  test('workflow selector lists user workflows', async ({ page }) => {
    await page.goto('/settings')
    await ensureIntegrationsTabActive(page)

    const selector = page.locator('[data-type="workflow-scope-selector"]')
    await selector.click()

    await expect(page.locator('[data-type="scope-user-level"]')).toBeVisible()
    await expect(page.locator(`[data-type="scope-workflow-${workflow1Id}"]`)).toBeVisible()
    await expect(page.locator(`[data-type="scope-workflow-${workflow2Id}"]`)).toBeVisible()
  })

  test('switching workflow scope refetches integrations with correct query param', async ({ page }) => {
    await page.goto('/settings')
    await ensureIntegrationsTabActive(page)

    const apiCalls: string[] = []
    page.on('request', request => {
      if (request.url().includes('/api/v2/integration') && request.method() === 'GET') {
        apiCalls.push(request.url())
      }
    })

    await selectWorkflowScope(page, workflow1Id)

    const workflowScopedCall = apiCalls.find(url => url.includes(`workflowId=${workflow1Id}`))
    expect(workflowScopedCall).toBeTruthy()
  })

  test('scope selection completes before subsequent operations', async ({ page }) => {
    await page.goto('/settings')
    await ensureIntegrationsTabActive(page)

    await page.request.post(`/api/v2/integration/mcp/items?workflowId=${workflow1Id}`, {
      data: {
        alias: '/scope-test-mcp',
        transport: 'stdio',
        toolName: 'test',
        command: 'node',
      },
    })

    await selectWorkflowScope(page, workflow1Id)

    const card = page.locator('[data-alias="/scope-test-mcp"]')
    await expect(card).toBeVisible({ timeout: 2000 })
  })

  test('sequential scope switches load correct data for each scope', async ({ page }) => {
    await page.goto('/settings')
    await ensureIntegrationsTabActive(page)

    await page.request.post(`/api/v2/integration/mcp/items?workflowId=${workflow1Id}`, {
      data: { alias: '/w1-item', transport: 'stdio', toolName: 'test', command: 'node' },
    })
    await page.request.post(`/api/v2/integration/mcp/items?workflowId=${workflow2Id}`, {
      data: { alias: '/w2-item', transport: 'stdio', toolName: 'test', command: 'node' },
    })

    await selectWorkflowScope(page, workflow1Id)
    await expect(page.locator('[data-alias="/w1-item"]')).toBeVisible()
    await expect(page.locator('[data-alias="/w2-item"]')).not.toBeVisible()

    await selectWorkflowScope(page, workflow2Id)
    await expect(page.locator('[data-alias="/w2-item"]')).toBeVisible()
    await expect(page.locator('[data-alias="/w1-item"]')).not.toBeVisible()
  })

  test('selecting same workflow scope twice is idempotent', async ({ page }) => {
    await page.goto('/settings')
    await ensureIntegrationsTabActive(page)

    await selectWorkflowScope(page, workflow1Id)
    await selectWorkflowScope(page, workflow1Id)

    const selector = page.locator('[data-type="workflow-scope-selector"]')
    await expect(selector).toContainText('Test Workflow 1')
  })

  test('user-level integration is created without workflowId', async ({ page }) => {
    await page.goto('/settings')
    await ensureIntegrationsTabActive(page)

    await page.locator('[data-type="add-integration"]').click()
    await page.locator('[data-title-id="integration.deepseek.title"]').click()

    await page.fill('input[name="apiKey"]', 'test-user-level-key')
    await page.locator('button[type="submit"]').click()

    await page.waitForTimeout(500)

    const response = await page.request.get('/api/v2/integration')
    const data = await response.json()

    expect(data.deepseek).toBeDefined()
    expect(data.deepseek.apiKey).toBe('')
    expect(data.secretsMeta?.deepseek?.apiKey).toBe(true)
  })

  test('workflow-scoped integration is created with correct workflowId', async ({ page }) => {
    /* Create workflow1-specific integration via API */
    await page.request.put(`/api/v2/integration/qwen/update?workflowId=${workflow1Id}`, {
      data: { apiKey: 'test-workflow1-key', model: 'qwen-turbo' },
    })

    /* Verify via API: workflow-scoped integration exists */
    const response = await page.request.get(`/api/v2/integration?workflowId=${workflow1Id}`)
    const data = await response.json()

    expect(data.qwen).toBeDefined()
    expect(data.qwen.apiKey).toBe('')
    expect(data.secretsMeta?.qwen?.apiKey).toBe(true)

    /* Verify user-level does NOT have it */
    const userResponse = await page.request.get('/api/v2/integration')
    const userData = await userResponse.json()
    expect(userData.qwen).toBeUndefined()
  })

  test('fallback: workflow without integration uses user-level', async ({ page }) => {
    /* Create user-level integration */
    await page.request.put('/api/v2/integration/claude/update', {
      data: { apiKey: 'user-level-claude-key', model: 'claude-3-5-sonnet-20241022' },
    })

    /* Query workflow1 (which has no claude integration) */
    const response = await page.request.get(`/api/v2/integration?workflowId=${workflow1Id}`)
    const data = await response.json()

    /* Should fall back to user-level */
    expect(data.claude).toBeDefined()
    expect(data.claude.apiKey).toBe('')
    expect(data.secretsMeta?.claude?.apiKey).toBe(true)
  })

  test('workflow-specific integration overrides user-level', async ({ page }) => {
    /* Create user-level integration */
    await page.request.put('/api/v2/integration/perplexity/update', {
      data: { apiKey: 'user-level-key', model: 'llama-3.1-sonar-small-128k-online' },
    })

    /* Create workflow1-specific integration */
    await page.request.put(`/api/v2/integration/perplexity/update?workflowId=${workflow1Id}`, {
      data: { apiKey: 'workflow1-key', model: 'llama-3.1-sonar-small-128k-online' },
    })

    /* Query workflow1 */
    const response1 = await page.request.get(`/api/v2/integration?workflowId=${workflow1Id}`)
    const data1 = await response1.json()
    expect(data1.perplexity.apiKey).toBe('')
    expect(data1.secretsMeta?.perplexity?.apiKey).toBe(true)

    /* Query user-level */
    const responseUser = await page.request.get('/api/v2/integration')
    const dataUser = await responseUser.json()
    expect(dataUser.perplexity.apiKey).toBe('')
    expect(dataUser.secretsMeta?.perplexity?.apiKey).toBe(true)
  })

  test('workflow-scoped MCP integration not visible in user-level UI', async ({ page }) => {
    await page.goto('/settings')
    await ensureIntegrationsTabActive(page)

    await page.request.post(`/api/v2/integration/mcp/items?workflowId=${workflow1Id}`, {
      data: {
        alias: '/workflow-only',
        transport: 'stdio',
        toolName: 'test',
        command: 'node',
      },
    })

    await page.goto('/settings')
    await ensureIntegrationsTabActive(page)

    await expect(page.locator('[data-alias="/workflow-only"]')).not.toBeVisible()
  })

  test('delete workflow-scoped integration does not affect user-level', async ({ page }) => {
    /* Create both */
    await page.request.put('/api/v2/integration/yandex/update', {
      data: { apiKey: 'user-key', folder_id: 'user-folder', model: 'yandexgpt' },
    })

    await page.request.put(`/api/v2/integration/yandex/update?workflowId=${workflow1Id}`, {
      data: { apiKey: 'workflow1-key', folder_id: 'workflow1-folder', model: 'yandexgpt' },
    })

    /* Delete workflow1-scoped */
    await page.request.delete(`/api/v2/integration/yandex/delete?workflowId=${workflow1Id}`)

    /* Verify workflow1 falls back to user-level */
    const response1 = await page.request.get(`/api/v2/integration?workflowId=${workflow1Id}`)
    const data1 = await response1.json()
    expect(data1.yandex.apiKey).toBe('')
    expect(data1.secretsMeta?.yandex?.apiKey).toBe(true)

    /* Verify user-level still exists */
    const responseUser = await page.request.get('/api/v2/integration')
    const dataUser = await responseUser.json()
    expect(dataUser.yandex.apiKey).toBe('')
    expect(dataUser.secretsMeta?.yandex?.apiKey).toBe(true)
  })

  test('delete user-level integration when workflow-scoped exists', async ({ page }) => {
    /* Create both */
    await page.request.put('/api/v2/integration/custom_llm/update', {
      data: { apiRootUrl: 'https://user.example.com', apiType: 'openai', maxTokens: 1000 },
    })

    await page.request.put(`/api/v2/integration/custom_llm/update?workflowId=${workflow1Id}`, {
      data: { apiRootUrl: 'https://workflow1.example.com', apiType: 'openai', maxTokens: 2000 },
    })

    /* Delete user-level */
    await page.request.delete('/api/v2/integration/custom_llm/delete')

    /* Verify user-level is gone */
    const responseUser = await page.request.get('/api/v2/integration')
    const dataUser = await responseUser.json()
    expect(dataUser.custom_llm).toBeUndefined()

    /* Verify workflow1-scoped still exists */
    const response1 = await page.request.get(`/api/v2/integration?workflowId=${workflow1Id}`)
    const data1 = await response1.json()
    expect(data1.custom_llm).toBeDefined()
    expect(data1.custom_llm.apiRootUrl).toBe('https://workflow1.example.com')
  })

  test('MCP integration: workflow-scoped CRUD', async ({ page }) => {
    const integrationPage = new ArrayIntegrationPage(page)
    await page.goto('/settings')
    await ensureIntegrationsTabActive(page)

    /* Select workflow1 scope */
    await selectWorkflowScope(page, workflow1Id)

    /* Add MCP integration using POM */
    await integrationPage.addMCPIntegration({
      alias: '/test-mcp-workflow1',
      transport: 'stdio',
      toolName: 'test-tool',
      command: 'node',
    })

    /* Verify via API */
    const response = await page.request.get(`/api/v2/integration?workflowId=${workflow1Id}`)
    const data = await response.json()

    expect(data.mcp).toBeDefined()
    expect(data.mcp.length).toBe(1)
    expect(data.mcp[0].alias).toBe('/test-mcp-workflow1')

    /* Verify user-level does NOT have it */
    const userResponse = await page.request.get('/api/v2/integration')
    const userData = await userResponse.json()
    expect(userData.mcp || []).toHaveLength(0)
  })

  test('RPC integration: workflow-scoped CRUD', async ({ page }) => {
    const integrationPage = new ArrayIntegrationPage(page)
    await page.goto('/settings')
    await ensureIntegrationsTabActive(page)

    /* Select workflow2 scope */
    await selectWorkflowScope(page, workflow2Id)

    /* Add RPC integration using POM */
    await integrationPage.addRPCIntegration({
      alias: '/test-rpc-workflow2',
      protocol: 'http',
      url: 'https://example.com/api',
    })

    /* Verify via API */
    const response = await page.request.get(`/api/v2/integration?workflowId=${workflow2Id}`)
    const data = await response.json()

    expect(data.rpc).toBeDefined()
    expect(data.rpc.length).toBe(1)
    expect(data.rpc[0].alias).toBe('/test-rpc-workflow2')

    /* Verify workflow1 does NOT have it */
    const workflow1Response = await page.request.get(`/api/v2/integration?workflowId=${workflow1Id}`)
    const workflow1Data = await workflow1Response.json()
    expect(workflow1Data.rpc || []).toHaveLength(0)
  })

  test('MCP delete: workflow-scoped deletion does not affect user-level', async ({ page }) => {
    /* Create user-level MCP */
    await page.request.post('/api/v2/integration/mcp/items', {
      data: {
        alias: '/user-mcp',
        transport: 'stdio',
        toolName: 'user-tool',
        command: 'node',
      },
    })

    /* Create workflow1-scoped MCP */
    await page.request.post(`/api/v2/integration/mcp/items?workflowId=${workflow1Id}`, {
      data: {
        alias: '/workflow1-mcp',
        transport: 'stdio',
        toolName: 'workflow1-tool',
        command: 'node',
      },
    })

    /* Delete workflow1-scoped */
    await page.request.delete(
      `/api/v2/integration/mcp/items/${encodeURIComponent('/workflow1-mcp')}?workflowId=${workflow1Id}`,
    )

    /* Verify user-level still exists */
    const userResponse = await page.request.get('/api/v2/integration')
    const userData = await userResponse.json()
    expect(userData.mcp).toBeDefined()
    expect(userData.mcp.find((m: any) => m.alias === '/user-mcp')).toBeDefined()

    /* Verify workflow1-scoped is gone */
    const workflow1Response = await page.request.get(`/api/v2/integration?workflowId=${workflow1Id}`)
    const workflow1Data = await workflow1Response.json()
    const hasWorkflow1MCP = (workflow1Data.mcp || []).find((m: any) => m.alias === '/workflow1-mcp')
    expect(hasWorkflow1MCP).toBeUndefined()
  })

  test('MCP delete: non-existent item in workflow scope is idempotent', async ({ page }) => {
    const deleteResponse = await page.request.delete(
      `/api/v2/integration/mcp/items/${encodeURIComponent('/never-existed')}?workflowId=${workflow1Id}`,
    )
    expect(deleteResponse.status()).toBe(204)
  })

  test('RPC delete: non-existent item in workflow scope is idempotent', async ({ page }) => {
    const deleteResponse = await page.request.delete(
      `/api/v2/integration/rpc/items/${encodeURIComponent('/never-existed')}?workflowId=${workflow2Id}`,
    )
    expect(deleteResponse.status()).toBe(204)
  })

  test('normalizes empty workflowId to null', async ({ page }) => {
    /* Create with empty string workflowId */
    const response = await page.request.put('/api/v2/integration/openai/update?workflowId=', {
      data: { apiKey: 'test-empty-workflow-id', model: 'gpt-4' },
    })

    expect(response.ok()).toBeTruthy()

    /* Verify it's stored as user-level (null workflowId) */
    const getResponse = await page.request.get('/api/v2/integration')
    const data = await getResponse.json()

    expect(data.openai).toBeDefined()
    expect(data.openai.apiKey).toBe('')
    expect(data.secretsMeta?.openai?.apiKey).toBe(true)
  })

  test('multiple workflows with different integrations are isolated', async ({ page }) => {
    /* Create different integrations for each workflow */
    await page.request.put(`/api/v2/integration/claude/update?workflowId=${workflow1Id}`, {
      data: { apiKey: 'workflow1-claude', model: 'claude-3-5-sonnet-20241022' },
    })

    await page.request.put(`/api/v2/integration/qwen/update?workflowId=${workflow2Id}`, {
      data: { apiKey: 'workflow2-qwen', model: 'qwen-turbo' },
    })

    /* Query workflow1: should have only claude */
    const response1 = await page.request.get(`/api/v2/integration?workflowId=${workflow1Id}`)
    const data1 = await response1.json()
    expect(data1.claude).toBeDefined()
    expect(data1.qwen).toBeUndefined()

    /* Query workflow2: should have only qwen */
    const response2 = await page.request.get(`/api/v2/integration?workflowId=${workflow2Id}`)
    const data2 = await response2.json()
    expect(data2.claude).toBeUndefined()
    expect(data2.qwen).toBeDefined()
  })

  test('cleanup verifies isolation: same alias different scopes', async ({ page }) => {
    const alias = '/shared-alias'

    await addMCPItemAtScope(page, { alias, transport: 'stdio', toolName: 'user-tool', command: 'node' })
    await addMCPItemAtScope(
      page,
      { alias, transport: 'stdio', toolName: 'workflow1-tool', command: 'node' },
      workflow1Id,
    )
    await addMCPItemAtScope(
      page,
      { alias, transport: 'stdio', toolName: 'workflow2-tool', command: 'node' },
      workflow2Id,
    )

    const userIntegration = await getIntegrationAtScope(page)
    const workflow1Integration = await getIntegrationAtScope(page, workflow1Id)
    const workflow2Integration = await getIntegrationAtScope(page, workflow2Id)

    expect(userIntegration.mcp.find((m: any) => m.alias === alias)?.toolName).toBe('user-tool')
    expect(workflow1Integration.mcp.find((m: any) => m.alias === alias)?.toolName).toBe('workflow1-tool')
    expect(workflow2Integration.mcp.find((m: any) => m.alias === alias)?.toolName).toBe('workflow2-tool')
  })

  test('cleanup verifies deletion: user-level delete preserves workflow-scoped', async ({ page }) => {
    const alias = '/delete-test'

    await addMCPItemAtScope(page, { alias, transport: 'stdio', toolName: 'user-tool', command: 'node' })
    await addMCPItemAtScope(
      page,
      { alias, transport: 'stdio', toolName: 'workflow1-tool', command: 'node' },
      workflow1Id,
    )

    await deleteMCPItemAtScope(page, alias)

    const userIntegration = await getIntegrationAtScope(page)
    const workflow1Integration = await getIntegrationAtScope(page, workflow1Id)

    expect(userIntegration.mcp || []).toHaveLength(0)
    expect(workflow1Integration.mcp.find((m: any) => m.alias === alias)?.toolName).toBe('workflow1-tool')
  })

  test('cleanup verifies deletion: workflow delete preserves user-level', async ({ page }) => {
    const alias = '/delete-workflow-test'

    await addMCPItemAtScope(page, { alias, transport: 'stdio', toolName: 'user-tool', command: 'node' })
    await addMCPItemAtScope(
      page,
      { alias, transport: 'stdio', toolName: 'workflow1-tool', command: 'node' },
      workflow1Id,
    )

    await deleteMCPItemAtScope(page, alias, workflow1Id)

    const userIntegration = await getIntegrationAtScope(page)
    const workflow1Integration = await getIntegrationAtScope(page, workflow1Id)

    expect(userIntegration.mcp.find((m: any) => m.alias === alias)?.toolName).toBe('user-tool')
    expect(workflow1Integration.mcp.find((m: any) => m.alias === alias)?.toolName).toBe('user-tool')
  })

  test('cleanup verifies RPC isolation across scopes', async ({ page }) => {
    const alias = '/rpc-shared'

    await addRPCItemAtScope(page, { alias, protocol: 'http', url: 'https://user.example.com' })
    await addRPCItemAtScope(page, { alias, protocol: 'http', url: 'https://workflow1.example.com' }, workflow1Id)
    await addRPCItemAtScope(page, { alias, protocol: 'http', url: 'https://workflow2.example.com' }, workflow2Id)

    const userIntegration = await getIntegrationAtScope(page)
    const workflow1Integration = await getIntegrationAtScope(page, workflow1Id)
    const workflow2Integration = await getIntegrationAtScope(page, workflow2Id)

    expect(userIntegration.rpc.find((r: any) => r.alias === alias)?.url).toBe('https://user.example.com')
    expect(workflow1Integration.rpc.find((r: any) => r.alias === alias)?.url).toBe('https://workflow1.example.com')
    expect(workflow2Integration.rpc.find((r: any) => r.alias === alias)?.url).toBe('https://workflow2.example.com')
  })

  test('cleanup verifies MCP+RPC mixed at different scopes', async ({ page }) => {
    await addMCPItemAtScope(page, { alias: '/user-mcp', transport: 'stdio', toolName: 'user', command: 'node' })
    await addRPCItemAtScope(
      page,
      { alias: '/workflow1-rpc', protocol: 'http', url: 'https://w1.example.com' },
      workflow1Id,
    )

    const userIntegration = await getIntegrationAtScope(page)
    const workflow1Integration = await getIntegrationAtScope(page, workflow1Id)

    expect(userIntegration.mcp).toHaveLength(1)
    expect(userIntegration.rpc || []).toHaveLength(0)

    expect(workflow1Integration.mcp || []).toHaveLength(0)
    expect(workflow1Integration.rpc).toHaveLength(1)
  })

  test('cleanup verifies empty array after scope-specific deletion', async ({ page }) => {
    await addMCPItemAtScope(
      page,
      { alias: '/item1', transport: 'stdio', toolName: 'tool1', command: 'node' },
      workflow1Id,
    )
    await addMCPItemAtScope(
      page,
      { alias: '/item2', transport: 'stdio', toolName: 'tool2', command: 'node' },
      workflow1Id,
    )

    await deleteMCPItemAtScope(page, '/item1', workflow1Id)
    await deleteMCPItemAtScope(page, '/item2', workflow1Id)

    const workflow1Integration = await getIntegrationAtScope(page, workflow1Id)
    expect(workflow1Integration.mcp || []).toHaveLength(0)
  })

  test('beforeEach cleanup prevents test pollution: multiple items at all scopes', async ({ page }) => {
    for (let i = 1; i <= 3; i++) {
      await addMCPItemAtScope(page, {
        alias: `/user-item-${i}`,
        transport: 'stdio',
        toolName: `tool${i}`,
        command: 'node',
      })
      await addMCPItemAtScope(
        page,
        { alias: `/w1-item-${i}`, transport: 'stdio', toolName: `tool${i}`, command: 'node' },
        workflow1Id,
      )
      await addMCPItemAtScope(
        page,
        { alias: `/w2-item-${i}`, transport: 'stdio', toolName: `tool${i}`, command: 'node' },
        workflow2Id,
      )
    }

    const userIntegration = await getIntegrationAtScope(page)
    const workflow1Integration = await getIntegrationAtScope(page, workflow1Id)
    const workflow2Integration = await getIntegrationAtScope(page, workflow2Id)

    expect(userIntegration.mcp).toHaveLength(3)
    expect(workflow1Integration.mcp).toHaveLength(3)
    expect(workflow2Integration.mcp).toHaveLength(3)
  })
})

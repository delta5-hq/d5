import { expect, test as base } from '@playwright/test'
import { adminLogin, subscriberLogin } from './utils'
import * as path from 'path'
import * as fs from 'fs'
import { cleanArrayIntegrations } from './helpers/array-integration-helpers'
import { ArrayIntegrationPage } from './pages/ArrayIntegrationPage'
import { selectRadixOption } from './helpers/radix-select-helper'

const test = base.extend<{}, { workerStorageState: string }>({
  storageState: ({ workerStorageState }, use) => use(workerStorageState),
  workerStorageState: [
    async ({ browser }, use, workerInfo) => {
      const id = workerInfo.parallelIndex
      const dir = path.resolve(process.cwd(), 'playwright/.auth')

      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

      const fileName = path.join(dir, `mcp-rpc-ui-user.${id}.json`)
      const context = await browser.newContext({
        storageState: undefined,
        baseURL: workerInfo.project.use.baseURL,
      })
      const page = await context.newPage()

      if (workerInfo.parallelIndex === 0) {
        await adminLogin(page)
      } else {
        await subscriberLogin(page)
      }

      await context.storageState({ path: fileName })
      await context.close()

      await use(fileName)
    },
    { scope: 'worker' },
  ],
})

test.describe.serial('MCP Integration UI Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await cleanArrayIntegrations(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('Add MCP stdio integration via UI', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    const card = await arrayPage.addMCPIntegration({
      alias: '/research',
      transport: 'stdio',
      toolName: 'auto',
      command: 'npx',
      args: '-y @mcp/server-research',
      description: 'Research assistant',
      toolInputField: 'prompt',
      timeoutMs: 120000,
    })

    await expect(card).toBeVisible()
    await expect(card).toContainText('/research')
    await expect(card).toContainText('Research assistant')
  })

  test('Add MCP HTTP integration via UI', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    const card = await arrayPage.addMCPIntegration({
      alias: '/httptool',
      transport: 'streamable-http',
      toolName: 'search',
      serverUrl: 'http://localhost:3100',
      description: 'HTTP MCP server',
      timeoutMs: 60000,
    })

    await expect(card).toBeVisible()
    await expect(card).toContainText('/httptool')
  })

  test('Edit MCP integration description via UI', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addMCPIntegration({
      alias: '/editable',
      transport: 'stdio',
      toolName: 'test',
      command: 'node',
      description: 'Original description',
    })

    await arrayPage.editMCPIntegration('/editable', {
      description: 'Updated description',
    })

    await arrayPage.verifyCardDescription('/editable', 'Updated description')
  })

  test('Delete MCP integration via UI', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addMCPIntegration({
      alias: '/deleteme',
      transport: 'stdio',
      toolName: 'test',
      command: 'echo',
    })

    await arrayPage.verifyCardVisible('/deleteme')
    await arrayPage.deleteIntegration('/deleteme', 'mcp')
    await arrayPage.verifyCardNotVisible('/deleteme')
  })

  test('Cancel MCP dialog does not create integration', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.openAddDialog('mcp')
    await arrayPage.fillMCPForm({
      alias: '/cancelled',
      transport: 'stdio',
      toolName: 'test',
      command: 'echo',
    })
    await arrayPage.cancelDialog()

    await arrayPage.verifyCardNotVisible('/cancelled')
  })

  test('Add multiple MCP integrations sequentially', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addMCPIntegration({
      alias: '/first',
      transport: 'stdio',
      toolName: 'tool1',
      command: 'node',
    })

    await arrayPage.addMCPIntegration({
      alias: '/second',
      transport: 'streamable-http',
      toolName: 'tool2',
      serverUrl: 'http://localhost:3100',
    })

    await arrayPage.addMCPIntegration({
      alias: '/third',
      transport: 'stdio',
      toolName: 'tool3',
      command: 'npx',
    })

    await arrayPage.verifyCardVisible('/first')
    await arrayPage.verifyCardVisible('/second')
    await arrayPage.verifyCardVisible('/third')

    await expect(page.locator('[data-alias]')).toHaveCount(3)
  })

  test('Edit MCP integration preserves unmodified fields', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addMCPIntegration({
      alias: '/preserve',
      transport: 'stdio',
      toolName: 'original-tool',
      command: 'node',
      description: 'Original description',
      timeoutMs: 120000,
    })

    await arrayPage.editMCPIntegration('/preserve', {
      description: 'New description',
    })

    await page.reload()
    await page.waitForLoadState('networkidle')

    await arrayPage.openEditDialog('/preserve')

    await expect(page.locator('#toolName')).toHaveValue('original-tool')
    await expect(page.locator('#command')).toHaveValue('node')
    await expect(page.locator('#description')).toHaveValue('New description')
    await expect(page.locator('#timeoutMs')).toHaveValue('120000')
  })

  test('Transport switch in edit mode preserves alias', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addMCPIntegration({
      alias: '/switcher',
      transport: 'stdio',
      toolName: 'tool',
      command: 'node',
    })

    await arrayPage.openEditDialog('/switcher')

    const aliasField = page.locator('#alias')
    await expect(aliasField).toBeDisabled()
    await expect(aliasField).toHaveValue('/switcher')

    const transportSelect = page
      .locator('[role="combobox"]')
      .filter({ hasText: /stdio|streamable-http/i })
      .first()

    await expect(transportSelect).toBeDisabled()
  })
})

test.describe.serial('RPC Integration UI Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await cleanArrayIntegrations(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('Add RPC SSH integration via UI', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    const card = await arrayPage.addRPCIntegration({
      alias: '/coder1',
      protocol: 'ssh',
      host: '192.168.1.100',
      port: 22,
      username: 'developer',
      privateKey: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
      commandTemplate: 'claude -p "{{prompt}}" --output-format json',
      description: 'Dev VM',
      outputFormat: 'json',
      outputField: 'output',
      sessionIdField: 'session_id',
      timeoutMs: 300000,
    })

    await expect(card).toBeVisible()
    await expect(card).toContainText('/coder1')
    await expect(card).toContainText('Dev VM')
  })

  test('Add RPC HTTP integration via UI', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    const card = await arrayPage.addRPCIntegration({
      alias: '/webhook',
      protocol: 'http',
      url: 'https://api.example.com/execute',
      method: 'POST',
      headers: 'Authorization=Bearer token\nContent-Type=application/json',
      bodyTemplate: '{"query":"{{prompt}}"}',
      outputFormat: 'json',
      outputField: 'result',
      description: 'External API',
    })

    await expect(card).toBeVisible()
    await expect(card).toContainText('/webhook')
  })

  test('Add RPC ACP-local integration via UI', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    const card = await arrayPage.addRPCIntegration({
      alias: '/cline',
      protocol: 'acp-local',
      command: 'cline',
      args: '--acp',
      env: 'API_KEY=test\nNODE_ENV=production',
      autoApprove: 'whitelist',
      allowedTools: 'read_file,write_file',
      timeoutMs: 600000,
      description: 'Local Cline ACP',
    })

    await expect(card).toBeVisible()
    await expect(card).toContainText('/cline')
  })

  test('Edit RPC HTTP headers via UI', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addRPCIntegration({
      alias: '/api',
      protocol: 'http',
      url: 'https://example.com/api',
      method: 'POST',
      headers: 'X-Old=old-value',
      bodyTemplate: '{"data":"{{prompt}}"}',
    })

    await arrayPage.editRPCIntegration('/api', {
      headers: 'X-New=new-value',
    })

    await page.reload()
    await page.waitForLoadState('networkidle')

    await arrayPage.openEditDialog('/api')

    const headersField = page.locator('#headers')
    await expect(headersField).toHaveValue('***=***')
  })

  test('Delete RPC integration via UI', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addRPCIntegration({
      alias: '/remove',
      protocol: 'ssh',
      host: '127.0.0.1',
      username: 'test',
      privateKey: 'test-key',
      commandTemplate: 'echo "{{prompt}}"',
    })

    await arrayPage.verifyCardVisible('/remove')
    await arrayPage.deleteIntegration('/remove', 'rpc')
    await arrayPage.verifyCardNotVisible('/remove')
  })

  test('Protocol switch changes form fields', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.openAddDialog('rpc')

    await page.locator('#alias').fill('/test')

    const dialogScope = page.locator('[data-dialog-name="rpc"]')
    await selectRadixOption(page, {
      triggerTextPattern: /ssh|http|acp-local/i,
      optionText: 'SSH',
      triggerScope: dialogScope,
    })

    await expect(page.locator('#host')).toBeVisible()
    await expect(page.locator('#username')).toBeVisible()
    await expect(page.locator('#privateKey')).toBeVisible()

    await selectRadixOption(page, {
      triggerTextPattern: /ssh|http|acp-local/i,
      optionText: 'HTTP',
      triggerScope: dialogScope,
    })

    await expect(page.locator('#url')).toBeVisible()
    await expect(page.locator('#method')).toBeVisible()
    await expect(page.locator('#host')).not.toBeVisible()

    await selectRadixOption(page, {
      triggerTextPattern: /ssh|http|acp-local/i,
      optionText: 'ACP-LOCAL',
      triggerScope: dialogScope,
    })

    await expect(page.locator('#command')).toBeVisible()
    await expect(page.locator('#autoApprove')).toBeVisible()
    await expect(page.locator('#url')).not.toBeVisible()
  })

  test('Claude CLI (SSH) preset button fills fields correctly', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.openAddDialog('rpc')

    await page.locator('#alias').fill('/claude')

    const presetButton = page.locator('button:has-text("🤖 Claude CLI (SSH)")')
    await presetButton.click()

    await page.waitForTimeout(100)

    const commandTemplate = page.locator('#commandTemplate')
    await expect(commandTemplate).toHaveValue(/claude -p "{{prompt}}".*--output-format json/)

    const outputField = page.locator('#outputField')
    await expect(outputField).toHaveValue('output')

    const sessionIdField = page.locator('#sessionIdField')
    await expect(sessionIdField).toHaveValue('session_id')
  })

  test('IDE (HTTP) preset button fills fields correctly', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.openAddDialog('rpc')

    await page.locator('#alias').fill('/ide-http')

    const presetButton = page.locator('button:has-text("🖥️ IDE (HTTP)")')
    await presetButton.click()

    await page.waitForTimeout(100)

    const url = page.locator('#url')
    await expect(url).toHaveValue('http://localhost:8080/api/v1/execute')

    const bodyTemplate = page.locator('#bodyTemplate')
    await expect(bodyTemplate).toHaveValue('{"command":"{{prompt}}"}')

    const outputField = page.locator('#outputField')
    await expect(outputField).toHaveValue('result')
  })

  test('IDE (ACP) preset button fills fields correctly', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.openAddDialog('rpc')

    await page.locator('#alias').fill('/ide-acp')

    const presetButton = page.locator('button:has-text("🖥️ IDE (ACP)")')
    await presetButton.click()

    await page.waitForTimeout(100)

    const command = page.locator('#command')
    await expect(command).toHaveValue('claude')

    const args = page.locator('#args')
    await expect(args).toHaveValue('--ide')

    const workingDir = page.locator('#workingDir')
    await expect(workingDir).toHaveValue('/workspace')
  })

  test('QA Testing (ACP) preset button fills fields correctly', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.openAddDialog('rpc')

    await page.locator('#alias').fill('/qa-acp')

    const presetButton = page.locator('button:has-text("🧪 QA Testing (ACP)")')
    await presetButton.click()

    await page.waitForTimeout(100)

    const command = page.locator('#command')
    await expect(command).toHaveValue('npx')

    const args = page.locator('#args')
    await expect(args).toHaveValue('playwright test')

    const workingDir = page.locator('#workingDir')
    await expect(workingDir).toHaveValue('/workspace')
  })

  test('QA Testing (MCP) preset button fills fields correctly', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.openAddDialog('mcp')

    await page.locator('#alias').fill('/qa-mcp')

    const presetButton = page.locator('button:has-text("🧪 QA Testing (MCP)")')
    await presetButton.click()

    await page.waitForTimeout(100)

    const command = page.locator('#command')
    await expect(command).toHaveValue('npx')

    const args = page.locator('#args')
    await expect(args).toHaveValue('@playwright/mcp@latest')

    const toolName = page.locator('#toolName')
    await expect(toolName).toHaveValue('auto')

    const timeoutMs = page.locator('#timeoutMs')
    await expect(timeoutMs).toHaveValue('300000')
  })

  test('Preset buttons are not visible in edit mode', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addRPCIntegration({
      alias: '/test-edit',
      protocol: 'ssh',
      host: '192.168.1.1',
      username: 'user1',
      privateKey: 'key1',
      commandTemplate: 'echo test',
    })

    await page.reload()
    await page.waitForLoadState('networkidle')

    const editButton = page.locator('button[aria-label="Edit /test-edit"]').first()
    await editButton.click()

    const presetSection = page.locator('text=Presets')
    await expect(presetSection).not.toBeVisible()
  })

  test('Add multiple RPC integrations with different protocols', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addRPCIntegration({
      alias: '/ssh1',
      protocol: 'ssh',
      host: '192.168.1.1',
      username: 'user1',
      privateKey: 'key1',
      commandTemplate: 'echo "{{prompt}}"',
    })

    await arrayPage.addRPCIntegration({
      alias: '/http1',
      protocol: 'http',
      url: 'https://api1.example.com',
      method: 'POST',
    })

    await arrayPage.addRPCIntegration({
      alias: '/acp1',
      protocol: 'acp-local',
      command: 'cline',
      args: '--acp',
    })

    await arrayPage.verifyCardVisible('/ssh1')
    await arrayPage.verifyCardVisible('/http1')
    await arrayPage.verifyCardVisible('/acp1')
  })

  test('Edit RPC integration preserves protocol-specific fields', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addRPCIntegration({
      alias: '/preserve-rpc',
      protocol: 'ssh',
      host: 'original-host',
      port: 22,
      username: 'original-user',
      privateKey: 'original-key',
      commandTemplate: 'original-command',
      description: 'Original',
    })

    await arrayPage.editRPCIntegration('/preserve-rpc', {
      description: 'Updated',
    })

    await page.reload()
    await page.waitForLoadState('networkidle')

    await arrayPage.openEditDialog('/preserve-rpc')

    await expect(page.locator('#host')).toHaveValue('original-host')
    await expect(page.locator('#port')).toHaveValue('22')
    await expect(page.locator('#username')).toHaveValue('original-user')
    await expect(page.locator('#description')).toHaveValue('Updated')
  })

  test('RPC protocol field is disabled in edit mode', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addRPCIntegration({
      alias: '/locked',
      protocol: 'ssh',
      host: '127.0.0.1',
      username: 'test',
      privateKey: 'key',
      commandTemplate: 'echo',
    })

    await arrayPage.openEditDialog('/locked')

    const aliasField = page.locator('#alias')
    await expect(aliasField).toBeDisabled()

    const protocolSelect = page
      .locator('[role="combobox"]')
      .filter({ hasText: /ssh|http|acp-local/i })
      .first()

    await expect(protocolSelect).toBeDisabled()
  })

  test('Cancel RPC dialog does not create integration', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.openAddDialog('rpc')
    await arrayPage.fillRPCForm({
      alias: '/cancelled-rpc',
      protocol: 'http',
      url: 'https://example.com',
      method: 'POST',
    })
    await arrayPage.cancelDialog()

    await arrayPage.verifyCardNotVisible('/cancelled-rpc')
  })
})

test.describe.serial('Cross-Field Independence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await cleanArrayIntegrations(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('MCP and RPC with same alias coexist independently', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addMCPIntegration({
      alias: '/shared',
      transport: 'stdio',
      toolName: 'mcp_tool',
      command: 'node',
    })

    await arrayPage.addRPCIntegration({
      alias: '/shared',
      protocol: 'ssh',
      host: '127.0.0.1',
      username: 'test',
      privateKey: 'key',
      commandTemplate: 'echo "{{prompt}}"',
    })

    await arrayPage.verifyCardVisible('/shared')

    const cards = page.locator('[data-alias="/shared"]')
    await expect(cards).toHaveCount(2)
  })

  test('Editing MCP does not affect RPC with same alias', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addMCPIntegration({
      alias: '/test',
      transport: 'stdio',
      toolName: 'tool1',
      command: 'node',
      description: 'MCP description',
    })

    await arrayPage.addRPCIntegration({
      alias: '/test',
      protocol: 'ssh',
      host: '127.0.0.1',
      username: 'user',
      privateKey: 'key',
      commandTemplate: 'echo',
      description: 'RPC description',
    })

    await page.reload()
    await page.waitForLoadState('networkidle')

    const mcpCard = page.locator('[data-alias="/test"]').filter({ hasText: 'MCP description' })
    const rpcCard = page.locator('[data-alias="/test"]').filter({ hasText: 'RPC description' })

    await expect(mcpCard).toBeVisible()
    await expect(rpcCard).toBeVisible()
  })

  test('Deleting MCP does not affect RPC with same alias', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addMCPIntegration({
      alias: '/shared-delete',
      transport: 'stdio',
      toolName: 'mcp-tool',
      command: 'node',
      description: 'MCP item',
    })

    await arrayPage.addRPCIntegration({
      alias: '/shared-delete',
      protocol: 'ssh',
      host: '127.0.0.1',
      username: 'test',
      privateKey: 'key',
      commandTemplate: 'echo',
      description: 'RPC item',
    })

    const mcpCard = page.locator('[data-alias="/shared-delete"]').filter({ hasText: 'MCP item' })
    const rpcCard = page.locator('[data-alias="/shared-delete"]').filter({ hasText: 'RPC item' })

    await expect(mcpCard).toBeVisible()
    await expect(rpcCard).toBeVisible()

    await arrayPage.deleteIntegration('/shared-delete', 'mcp')

    await expect(mcpCard).not.toBeVisible()
    await expect(rpcCard).toBeVisible()
  })

  test('Empty state shows when all integrations deleted via UI', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addMCPIntegration({
      alias: '/temp1',
      transport: 'stdio',
      toolName: 'tool',
      command: 'node',
    })

    await arrayPage.addMCPIntegration({
      alias: '/temp2',
      transport: 'stdio',
      toolName: 'tool',
      command: 'npx',
    })

    await arrayPage.deleteIntegration('/temp1', 'mcp')
    await arrayPage.deleteIntegration('/temp2', 'mcp')

    const emptyState = page.locator('[data-type="add-mcp"]')
    await expect(emptyState).toBeVisible()
  })
})

test.describe.serial('UI Form Validation Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await cleanArrayIntegrations(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('MCP form fields persist when switching transports back and forth', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.openAddDialog('mcp')

    await page.locator('#alias').fill('/persist-test')
    await page.locator('#toolName').fill('test-tool')
    await page.locator('#description').fill('Test description')

    const dialogScope = page.locator('[data-dialog-name="mcp"]')
    await selectRadixOption(page, {
      triggerTextPattern: /stdio|streamable-http/i,
      optionText: 'stdio',
      triggerScope: dialogScope,
    })

    await page.locator('#command').fill('node')

    await selectRadixOption(page, {
      triggerTextPattern: /stdio|streamable-http/i,
      optionText: 'streamable-http',
      triggerScope: dialogScope,
    })

    await expect(page.locator('#alias')).toHaveValue('/persist-test')
    await expect(page.locator('#toolName')).toHaveValue('test-tool')
    await expect(page.locator('#description')).toHaveValue('Test description')
  })

  test('RPC form fields persist when switching protocols back and forth', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.openAddDialog('rpc')

    await page.locator('#alias').fill('/rpc-persist')
    await page.locator('#description').fill('Persistent description')

    const dialogScope = page.locator('[data-dialog-name="rpc"]')
    await selectRadixOption(page, {
      triggerTextPattern: /ssh|http|acp-local/i,
      optionText: 'SSH',
      triggerScope: dialogScope,
    })

    await selectRadixOption(page, {
      triggerTextPattern: /ssh|http|acp-local/i,
      optionText: 'HTTP',
      triggerScope: dialogScope,
    })

    await selectRadixOption(page, {
      triggerTextPattern: /ssh|http|acp-local/i,
      optionText: 'SSH',
      triggerScope: dialogScope,
    })

    await expect(page.locator('#alias')).toHaveValue('/rpc-persist')
    await expect(page.locator('#description')).toHaveValue('Persistent description')
  })

  test('MCP edit dialog pre-fills all fields correctly', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addMCPIntegration({
      alias: '/prefill-test',
      transport: 'stdio',
      toolName: 'test-tool',
      command: 'node',
      args: '--experimental-modules',
      description: 'Test integration',
      toolInputField: 'input',
      timeoutMs: 90000,
    })

    await arrayPage.openEditDialog('/prefill-test')

    await expect(page.locator('#alias')).toHaveValue('/prefill-test')
    await expect(page.locator('#toolName')).toHaveValue('test-tool')
    await expect(page.locator('#command')).toHaveValue('node')
    await expect(page.locator('#args')).toHaveValue('--experimental-modules')
    await expect(page.locator('#description')).toHaveValue('Test integration')
    await expect(page.locator('#toolInputField')).toHaveValue('input')
    await expect(page.locator('#timeoutMs')).toHaveValue('90000')
  })

  test('RPC edit dialog pre-fills complex multiline fields correctly', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    const multilineHeaders = 'Authorization=Bearer token123\nContent-Type=application/json\nX-Custom=value'

    await arrayPage.addRPCIntegration({
      alias: '/complex-prefill',
      protocol: 'http',
      url: 'https://api.example.com/v1/execute',
      method: 'POST',
      headers: multilineHeaders,
      bodyTemplate: '{"query":"{{prompt}}","model":"gpt-4"}',
      outputFormat: 'json',
      outputField: 'result.data',
      description: 'Complex HTTP integration',
      timeoutMs: 180000,
    })

    await arrayPage.openEditDialog('/complex-prefill')

    await expect(page.locator('#url')).toHaveValue('https://api.example.com/v1/execute')
    await expect(page.locator('#headers')).toHaveValue('***=***')
    await expect(page.locator('#bodyTemplate')).toHaveValue('{"query":"{{prompt}}","model":"gpt-4"}')
    await expect(page.locator('#outputField')).toHaveValue('result.data')
    await expect(page.locator('#timeoutMs')).toHaveValue('180000')
  })

  test('RPC dialog all Select fields have non-empty defaults on protocol switch', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.openAddDialog('rpc')

    const dialogScope = page.locator('[data-dialog-name="rpc"]')
    const protocols = [
      { name: 'SSH', selects: ['outputFormat'] },
      { name: 'HTTP', selects: ['method', 'outputFormat'] },
      { name: 'ACP-LOCAL', selects: ['autoApprove'] },
    ]

    for (const { name, selects } of protocols) {
      await selectRadixOption(page, {
        triggerTextPattern: /ssh|http|acp-local/i,
        optionText: name,
        triggerScope: dialogScope,
      })

      for (const selectId of selects) {
        const selectTrigger = dialogScope.locator(`#${selectId}`)
        const triggerText = await selectTrigger.textContent()
        expect(triggerText?.trim()).not.toBe('')
      }
    }
  })

  test('RPC dialog Select defaults match schema defaults', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.openAddDialog('rpc')

    const dialogScope = page.locator('[data-dialog-name="rpc"]')

    await selectRadixOption(page, {
      triggerTextPattern: /ssh|http|acp-local/i,
      optionText: 'SSH',
      triggerScope: dialogScope,
    })
    await expect(dialogScope.locator('#outputFormat')).toContainText(/TEXT/i)

    await selectRadixOption(page, {
      triggerTextPattern: /ssh|http|acp-local/i,
      optionText: 'HTTP',
      triggerScope: dialogScope,
    })
    await expect(dialogScope.locator('#method')).toContainText(/POST/i)
    await expect(dialogScope.locator('#outputFormat')).toContainText(/TEXT/i)

    await selectRadixOption(page, {
      triggerTextPattern: /ssh|http|acp-local/i,
      optionText: 'ACP-LOCAL',
      triggerScope: dialogScope,
    })
    await expect(dialogScope.locator('#autoApprove')).toContainText(/none/i)
  })

  test('MCP dialog Select defaults are always defined', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.openAddDialog('mcp')

    const dialogScope = page.locator('[data-dialog-name="mcp"]')
    const transports = ['stdio', 'streamable-http']

    for (const transport of transports) {
      await selectRadixOption(page, {
        triggerTextPattern: /stdio|streamable-http/i,
        optionText: transport,
        triggerScope: dialogScope,
      })

      const transportTrigger = dialogScope
        .locator('[role="combobox"]')
        .filter({ hasText: /stdio|streamable-http/i })
        .first()
      const triggerText = await transportTrigger.textContent()
      expect(triggerText?.trim()).not.toBe('')
    }
  })
})

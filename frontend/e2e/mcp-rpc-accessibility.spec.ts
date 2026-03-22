import { expect, test as base } from '@playwright/test'
import { e2eEnv } from './utils/e2e-env-vars'
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

      const fileName = path.join(dir, `accessibility-user.${id}.json`)
      const page = await browser.newPage({
        baseURL: workerInfo.project.use.baseURL,
      })

      const credentials =
        workerInfo.parallelIndex === 0
          ? { usernameOrEmail: e2eEnv.E2E_ADMIN_USER, password: e2eEnv.E2E_ADMIN_PASS }
          : {
              usernameOrEmail: e2eEnv.E2E_SUBSCRIBER_USER || 'subscriber',
              password: e2eEnv.E2E_SUBSCRIBER_PASS || 'P@ssw0rd!',
            }

      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const result = await page.evaluate(async (creds) => {
        const resp = await fetch('/api/v2/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(creds),
        })
        return { ok: resp.ok, status: resp.status, text: await resp.text() }
      }, credentials)

      if (!result.ok) {
        throw new Error(`Auth failed: ${result.status} ${result.text}`)
      }

      await page.context().storageState({ path: fileName })
      await page.close()

      await use(fileName)
    },
    { scope: 'worker' },
  ],
})

test.describe.serial('Accessibility: ARIA Labels and Screen Reader Support', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await cleanArrayIntegrations(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('Add MCP button has aria-label', async ({ page }) => {
    const addButton = page.locator('[data-type="add-mcp"]')
    await expect(addButton).toHaveAttribute('aria-label', 'Add mcp integration')
  })

  test('Add RPC button has aria-label', async ({ page }) => {
    const addButton = page.locator('[data-type="add-rpc"]')
    await expect(addButton).toHaveAttribute('aria-label', 'Add rpc integration')
  })

  test('Required fields in MCP dialog have aria-required', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()
    await arrayPage.openAddDialog('mcp')

    await expect(page.locator('#alias')).toHaveAttribute('aria-required', 'true')
    await expect(page.locator('#toolName')).toHaveAttribute('aria-required', 'true')
  })

  test('Required fields in RPC SSH dialog have aria-required', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()
    await arrayPage.openAddDialog('rpc')

    await expect(page.locator('#alias')).toHaveAttribute('aria-required', 'true')
  })

  test('Edit button has aria-label with alias', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addMCPIntegration({
      alias: '/test-alias',
      transport: 'stdio',
      toolName: 'test',
      command: 'echo',
    })

    const card = page.locator('[data-alias="/test-alias"]')
    const editButton = card.locator('button').filter({ hasText: /edit integration/i }).or(card.locator('button[aria-label*="Edit"]'))

    await expect(editButton.first()).toHaveAttribute('aria-label', 'Edit /test-alias')
  })

  test('Delete button has aria-label with alias', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addMCPIntegration({
      alias: '/deletable',
      transport: 'stdio',
      toolName: 'test',
      command: 'node',
    })

    const card = page.locator('[data-alias="/deletable"]')
    const deleteButton = card.locator('button').filter({ hasText: /delete integration/i }).or(card.locator('button[aria-label*="Delete"]'))

    await expect(deleteButton.first()).toHaveAttribute('aria-label', 'Delete /deletable')
  })

  test('Edit and delete buttons have sr-only text for screen readers', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addMCPIntegration({
      alias: '/sr-test',
      transport: 'stdio',
      toolName: 'test',
      command: 'node',
    })

    const card = page.locator('[data-alias="/sr-test"]')
    const srOnlyElements = card.locator('.sr-only')

    await expect(srOnlyElements).toHaveCount(2)
    await expect(srOnlyElements.nth(0)).toContainText('Edit integration')
    await expect(srOnlyElements.nth(1)).toContainText('Delete integration')
  })

  test('Dialog close button has sr-only text', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()
    await arrayPage.openAddDialog('mcp')

    const closeButton = page.locator('[data-dialog-name="mcp"] .sr-only')
    await expect(closeButton.first()).toContainText('Close')
  })

  test('Icons are marked as aria-hidden', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addMCPIntegration({
      alias: '/icon-test',
      transport: 'stdio',
      toolName: 'test',
      command: 'node',
    })

    const card = page.locator('[data-alias="/icon-test"]')
    const icons = card.locator('svg[aria-hidden="true"]')

    await expect(icons).toHaveCount(2)
  })

  test('Required field indicators have aria-label', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()
    await arrayPage.openAddDialog('mcp')

    const requiredSpans = page.locator('span[aria-label="required"]')
    await expect(requiredSpans.first()).toBeVisible()
  })
})

test.describe.serial('Delete Confirmation Dialog Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await cleanArrayIntegrations(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('Delete opens confirmation dialog instead of browser confirm', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addMCPIntegration({
      alias: '/confirm-test',
      transport: 'stdio',
      toolName: 'test',
      command: 'node',
    })

    const card = page.locator('[data-alias="/confirm-test"]')
    const deleteButton = card.locator('button').filter({ hasText: /delete integration/i }).or(card.locator('button[aria-label*="Delete"]')).first()

    await deleteButton.click()

    const confirmDialog = page.locator('.max-w-md:has-text("Delete Integration")')
    await expect(confirmDialog).toBeVisible()
  })

  test('Confirmation dialog shows alias in message', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addMCPIntegration({
      alias: '/my-integration',
      transport: 'stdio',
      toolName: 'test',
      command: 'node',
    })

    const card = page.locator('[data-alias="/my-integration"]')
    const deleteButton = card.locator('button').filter({ hasText: /delete integration/i }).or(card.locator('button[aria-label*="Delete"]')).first()

    await deleteButton.click()

    const dialog = page.locator('text=/my-integration/').and(page.locator('text=/cannot be undone/'))
    await expect(dialog).toBeVisible()
  })

  test('Cancel button in confirmation dialog does not delete', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addMCPIntegration({
      alias: '/cancel-test',
      transport: 'stdio',
      toolName: 'test',
      command: 'node',
    })

    const card = page.locator('[data-alias="/cancel-test"]')
    const deleteButton = card.locator('button').filter({ hasText: /delete integration/i }).or(card.locator('button[aria-label*="Delete"]')).first()

    await deleteButton.click()

    const confirmDialog = page.locator('.max-w-md:has-text("Delete Integration")')
    await expect(confirmDialog).toBeVisible()

    const cancelButton = page.locator('button:has-text("Cancel")')
    await cancelButton.click()

    await expect(confirmDialog).not.toBeVisible()
    await expect(card).toBeVisible()
  })

  test('Confirm button in dialog deletes integration', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addMCPIntegration({
      alias: '/will-delete',
      transport: 'stdio',
      toolName: 'test',
      command: 'node',
    })

    const card = page.locator('[data-alias="/will-delete"]')
    const deleteButton = card.locator('button').filter({ hasText: /delete integration/i }).or(card.locator('button[aria-label*="Delete"]')).first()

    await deleteButton.click()

    const confirmDialog = page.locator('.max-w-md:has-text("Delete Integration")')
    const confirmButton = confirmDialog.locator('button:has-text("Delete")')
    await confirmButton.click()

    await expect(card).not.toBeVisible()
  })

  test('Confirmation dialog has AlertTriangle icon with aria-hidden', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addMCPIntegration({
      alias: '/icon-check',
      transport: 'stdio',
      toolName: 'test',
      command: 'node',
    })

    const card = page.locator('[data-alias="/icon-check"]')
    const deleteButton = card.locator('button').filter({ hasText: /delete integration/i }).or(card.locator('button[aria-label*="Delete"]')).first()

    await deleteButton.click()

    const alertIcon = page.locator('svg[aria-hidden="true"].text-destructive')
    await expect(alertIcon).toBeVisible()
  })
})

test.describe.serial('Protocol and Transport Badges', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await cleanArrayIntegrations(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('MCP stdio integration shows STDIO badge', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addMCPIntegration({
      alias: '/stdio-badge',
      transport: 'stdio',
      toolName: 'test',
      command: 'node',
    })

    const card = page.locator('[data-alias="/stdio-badge"]')
    const badge = card.getByText('STDIO', { exact: true })

    await expect(badge).toBeVisible()
  })

  test('MCP streamable-http integration shows HTTP badge', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addMCPIntegration({
      alias: '/http-badge',
      transport: 'streamable-http',
      toolName: 'test',
      serverUrl: 'http://localhost:3100',
    })

    const card = page.locator('[data-alias="/http-badge"]')
    const badge = card.getByText('HTTP', { exact: true })

    await expect(badge).toBeVisible()
  })

  test('RPC SSH integration shows SSH badge', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addRPCIntegration({
      alias: '/ssh-badge',
      protocol: 'ssh',
      host: '127.0.0.1',
      username: 'test',
      privateKey: 'key',
      commandTemplate: 'echo "{{prompt}}"',
    })

    const card = page.locator('[data-alias="/ssh-badge"]')
    const badge = card.getByText('SSH', { exact: true })

    await expect(badge).toBeVisible()
  })

  test('RPC HTTP integration shows HTTP badge', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addRPCIntegration({
      alias: '/http-rpc-badge',
      protocol: 'http',
      url: 'https://example.com',
      method: 'POST',
    })

    const card = page.locator('[data-alias="/http-rpc-badge"]')
    const badge = card.getByText('HTTP', { exact: true })

    await expect(badge).toBeVisible()
  })

  test('RPC ACP-local integration shows ACP badge', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addRPCIntegration({
      alias: '/acp-badge',
      protocol: 'acp-local',
      command: 'cline',
      args: '--acp',
    })

    const card = page.locator('[data-alias="/acp-badge"]')
    const badge = card.getByText('ACP', { exact: true })

    await expect(badge).toBeVisible()
  })

  test('Badge appears next to alias in card header', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addMCPIntegration({
      alias: '/badge-position',
      transport: 'stdio',
      toolName: 'test',
      command: 'node',
    })

    const card = page.locator('[data-alias="/badge-position"]')
    const badge = card.getByText('STDIO', { exact: true })

    await expect(card).toContainText('/badge-position')
    await expect(badge).toBeVisible()
  })

  test('Multiple integrations show correct badges independently', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addMCPIntegration({
      alias: '/mcp-stdio',
      transport: 'stdio',
      toolName: 'test',
      command: 'node',
    })

    await arrayPage.addMCPIntegration({
      alias: '/mcp-http',
      transport: 'streamable-http',
      toolName: 'test',
      serverUrl: 'http://localhost:3100',
    })

    await arrayPage.addRPCIntegration({
      alias: '/rpc-ssh',
      protocol: 'ssh',
      host: '127.0.0.1',
      username: 'test',
      privateKey: 'key',
      commandTemplate: 'echo',
    })

    const stdioCard = page.locator('[data-alias="/mcp-stdio"]')
    const httpCard = page.locator('[data-alias="/mcp-http"]')
    const sshCard = page.locator('[data-alias="/rpc-ssh"]')

    await expect(stdioCard.getByText('STDIO', { exact: true })).toBeVisible()
    await expect(httpCard.getByText('HTTP', { exact: true })).toBeVisible()
    await expect(sshCard.getByText('SSH', { exact: true })).toBeVisible()
  })
})

test.describe.serial('Responsive Dialog Sizing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await cleanArrayIntegrations(page)
  })

  test('MCP dialog does not overflow viewport on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()
    await arrayPage.openAddDialog('mcp')

    const dialog = page.locator('[data-dialog-name="mcp"]')
    const box = await dialog.boundingBox()

    expect(box).not.toBeNull()
    expect(box!.width).toBeLessThanOrEqual(375)
  })

  test('RPC dialog does not overflow viewport on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()
    await arrayPage.openAddDialog('rpc')

    const dialog = page.locator('[data-dialog-name="rpc"]')
    const box = await dialog.boundingBox()

    expect(box).not.toBeNull()
    expect(box!.width).toBeLessThanOrEqual(375)
  })

  test('Dialog is scrollable when content exceeds viewport height', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()
    await arrayPage.openAddDialog('rpc')

    const dialog = page.locator('[data-dialog-name="rpc"]')
    const isScrollable = await dialog.evaluate(el => el.scrollHeight > el.clientHeight)

    expect(isScrollable).toBe(true)
  })
})

test.describe.serial('Internationalization (i18n) Labels', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await cleanArrayIntegrations(page)
  })

  test('MCP dialog uses i18n labels for fields', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()
    await arrayPage.openAddDialog('mcp')

    await expect(page.locator('label[for="alias"]:has-text("Alias")')).toBeVisible()
    await expect(page.locator('label[for="transport"]:has-text("Transport")')).toBeVisible()
    await expect(page.locator('label[for="description"]:has-text("Description")')).toBeVisible()
    await expect(page.locator('label[for="toolName"]:has-text("Tool Name")')).toBeVisible()
    await expect(page.locator('label[for="command"]:has-text("Command")')).toBeVisible()
    await expect(page.locator('label[for="timeoutMs"]:has-text("Timeout")')).toBeVisible()
  })

  test('RPC dialog uses i18n labels for SSH fields', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()
    await arrayPage.openAddDialog('rpc')

    const dialogScope = page.locator('[data-dialog-name="rpc"]')
    await selectRadixOption(page, {
      triggerTextPattern: /ssh|http|acp-local/i,
      optionText: 'SSH',
      triggerScope: dialogScope,
    })

    await expect(page.locator('label[for="alias"]:has-text("Alias")')).toBeVisible()
    await expect(page.locator('label[for="protocol"]:has-text("Protocol")')).toBeVisible()
    await expect(page.locator('label[for="description"]:has-text("Description")')).toBeVisible()
  })

  test('Delete confirmation dialog uses i18n messages', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    await arrayPage.addMCPIntegration({
      alias: '/i18n-test',
      transport: 'stdio',
      toolName: 'test',
      command: 'node',
    })

    const card = page.locator('[data-alias="/i18n-test"]')
    const deleteButton = card.locator('button').filter({ hasText: /delete integration/i }).or(card.locator('button[aria-label*="Delete"]')).first()

    await deleteButton.click()

    await expect(page.locator('h2:has-text("Delete Integration")')).toBeVisible()
    await expect(page.locator('text=/cannot be undone/')).toBeVisible()
  })

  test('Empty state shows i18n message', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('text=No integrations yet').first()).toBeVisible()
  })
})

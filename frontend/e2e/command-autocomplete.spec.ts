import { test, expect } from '@playwright/test'
import { adminLogin, createWorkflow } from './utils'
import { cleanArrayIntegrations, addArrayItem } from './helpers/array-integration-helpers'
import { setupWorkflowWithCommandField } from './helpers/workflow-node-setup'

test.describe('Command Autocomplete', () => {
  test.describe.configure({ mode: 'serial' })
  let workflowId: string

  test.beforeEach(async ({ page }) => {
    await page.goto('/workflows')
    await adminLogin(page)
    await cleanArrayIntegrations(page)
    workflowId = await createWorkflow(page)
    await page.waitForLoadState('networkidle')

    await setupWorkflowWithCommandField(page)
  })

  test.afterEach(async ({ page }) => {
    await cleanArrayIntegrations(page)
  })

  test('popover appears when / typed at start of field', async ({ page }) => {
    const commandField = page.locator('textarea[data-type="command-field"]').first()
    await commandField.click()
    await commandField.fill('/')

    const autocomplete = page.locator('[data-type="autocomplete-suggestions"]')
    await expect(autocomplete).toBeVisible({ timeout: 5000 })

    const suggestions = page.locator('[data-type="autocomplete-item"]')
    await expect(suggestions).not.toHaveCount(0)
  })

  test('suggestions filter on continued typing', async ({ page }) => {
    const commandField = page.locator('textarea[data-type="command-field"]').first()
    await commandField.click()
    await commandField.fill('/')

    const autocomplete = page.locator('[data-type="autocomplete-suggestions"]')
    await expect(autocomplete).toBeVisible({ timeout: 5000 })

    const initialCount = await page.locator('[data-type="autocomplete-item"]').count()

    await commandField.fill('/cha')
    await page.waitForTimeout(100)

    const filteredCount = await page.locator('[data-type="autocomplete-item"]').count()
    expect(filteredCount).toBeLessThan(initialCount)
    expect(filteredCount).toBeGreaterThan(0)

    const chatItem = page.locator('[data-type="autocomplete-item"][data-command="/chat"]')
    await expect(chatItem).toBeVisible()
  })

  test('Enter key selects suggestion', async ({ page }) => {
    const commandField = page.locator('textarea[data-type="command-field"]').first()
    await commandField.click()
    await commandField.fill('/cha')

    const autocomplete = page.locator('[data-type="autocomplete-suggestions"]')
    await expect(autocomplete).toBeVisible({ timeout: 5000 })

    await commandField.press('Enter')

    const autocompleteAfter = page.locator('[data-type="autocomplete-suggestions"]')
    await expect(autocompleteAfter).not.toBeVisible()

    const fieldValue = await commandField.inputValue()
    expect(fieldValue).toMatch(/^\/chat(gpt)?\s/)
  })

  test('Escape dismisses autocomplete', async ({ page }) => {
    const commandField = page.locator('textarea[data-type="command-field"]').first()
    await commandField.click()
    await commandField.fill('/')

    const autocomplete = page.locator('[data-type="autocomplete-suggestions"]')
    await expect(autocomplete).toBeVisible({ timeout: 5000 })

    await commandField.press('Escape')

    await expect(autocomplete).not.toBeVisible()
  })

  test('ArrowDown and ArrowUp navigate suggestions', async ({ page }) => {
    const commandField = page.locator('textarea[data-type="command-field"]').first()
    await commandField.click()
    await commandField.fill('/')

    const autocomplete = page.locator('[data-type="autocomplete-suggestions"]')
    await expect(autocomplete).toBeVisible({ timeout: 5000 })

    const firstItem = page.locator('[data-type="autocomplete-item"]').first()
    await expect(firstItem).toHaveClass(/bg-accent/)

    await commandField.press('ArrowDown')
    await page.waitForTimeout(100)

    const secondItem = page.locator('[data-type="autocomplete-item"]').nth(1)
    await expect(secondItem).toHaveClass(/bg-accent/)

    await commandField.press('ArrowUp')
    await page.waitForTimeout(100)

    await expect(firstItem).toHaveClass(/bg-accent/)
  })

  test('MCP alias shows mcp badge', async ({ page }) => {
    await addArrayItem(page, 'mcp', {
      alias: '/testmcp',
      transport: 'stdio',
      toolName: 'test_tool',
      description: 'Test MCP integration',
      command: 'node',
      args: ['server.js'],
    })

    await page.reload()
    await page.waitForLoadState('networkidle')
    await setupWorkflowWithCommandField(page)

    const commandField = page.locator('textarea[data-type="command-field"]').first()
    await commandField.click()
    await commandField.fill('/test')

    const autocomplete = page.locator('[data-type="autocomplete-suggestions"]')
    await expect(autocomplete).toBeVisible({ timeout: 5000 })

    const mcpItem = page.locator('[data-type="autocomplete-item"][data-command="/testmcp"]')
    await expect(mcpItem).toBeVisible()

    const badge = mcpItem.locator('[data-badge="mcp"]')
    await expect(badge).toBeVisible()
    await expect(badge).toHaveText('mcp')
  })

  test('RPC alias shows rpc badge', async ({ page }) => {
    await addArrayItem(page, 'rpc', {
      alias: '/testrpc',
      protocol: 'ssh',
      description: 'Test RPC integration',
      commandTemplate: 'echo "{{prompt}}"',
    })

    await page.reload()
    await page.waitForLoadState('networkidle')
    await setupWorkflowWithCommandField(page)

    const commandField = page.locator('textarea[data-type="command-field"]').first()
    await commandField.click()
    await commandField.fill('/test')

    const autocomplete = page.locator('[data-type="autocomplete-suggestions"]')
    await expect(autocomplete).toBeVisible({ timeout: 5000 })

    const rpcItem = page.locator('[data-type="autocomplete-item"][data-command="/testrpc"]')
    await expect(rpcItem).toBeVisible()

    const badge = rpcItem.locator('[data-badge="rpc"]')
    await expect(badge).toBeVisible()
    await expect(badge).toHaveText('rpc')
  })

  test('clicking suggestion selects it without blur', async ({ page }) => {
    const commandField = page.locator('textarea[data-type="command-field"]').first()
    await commandField.click()
    await commandField.fill('/cha')

    const autocomplete = page.locator('[data-type="autocomplete-suggestions"]')
    await expect(autocomplete).toBeVisible({ timeout: 5000 })

    const chatItem = page.locator('[data-type="autocomplete-item"][data-command="/chat"]')
    await chatItem.click()

    await expect(autocomplete).not.toBeVisible()

    const fieldValue = await commandField.inputValue()
    expect(fieldValue).toMatch(/^\/chat\s/)

    await expect(commandField).toBeFocused()
  })

  test('autocomplete only triggers on first line', async ({ page }) => {
    const commandField = page.locator('textarea[data-type="command-field"]').first()
    await commandField.click()
    await commandField.fill('/chat test prompt\n/')

    const autocomplete = page.locator('[data-type="autocomplete-suggestions"]')
    await expect(autocomplete).not.toBeVisible()
  })

  test('autocomplete shows description for MCP alias', async ({ page }) => {
    const testDescription = 'Custom MCP tool description'
    await addArrayItem(page, 'mcp', {
      alias: '/described',
      transport: 'stdio',
      toolName: 'test_tool',
      description: testDescription,
      command: 'node',
      args: ['server.js'],
    })

    await page.reload()
    await page.waitForLoadState('networkidle')
    await setupWorkflowWithCommandField(page)

    const commandField = page.locator('textarea[data-type="command-field"]').first()
    await commandField.click()
    await commandField.fill('/desc')

    const autocomplete = page.locator('[data-type="autocomplete-suggestions"]')
    await expect(autocomplete).toBeVisible({ timeout: 5000 })

    const describedItem = page.locator('[data-type="autocomplete-item"][data-command="/described"]')
    await expect(describedItem).toBeVisible()
    await expect(describedItem).toContainText(testDescription)
  })
})

/**
 * Radix Select Portal Behavior Tests
 *
 * Purpose: Validate generalized Radix Select interaction patterns across edge cases
 * NOT coupled to specific integration bugs, but to the portal rendering behavior itself
 *
 * Architecture: Radix Select uses <SelectPrimitive.Portal> to render options to document.body,
 * outside the component DOM tree. This test suite validates the interaction pattern works
 * correctly regardless of:
 * - Multiple Radix Selects on the same page
 * - Nested/scoped selection contexts (dialogs, modals, etc.)
 * - Rapid open/close cycles (portal animation overlap)
 * - Option text collisions across different selects
 */

import { expect } from '@playwright/test'
import { cleanArrayIntegrations } from './helpers/array-integration-helpers'
import { ArrayIntegrationPage } from './pages/ArrayIntegrationPage'
import { createParallelUserTest } from './fixtures/parallel-user-test'
import { selectRadixOption } from './helpers/radix-select-helper'

const test = createParallelUserTest('radix-select-user')

test.describe('Radix Select Portal Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await cleanArrayIntegrations(page)
  })

  test('workflow-scope-selector and dialog protocol selector coexist without collision', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()

    const workflowSelector = page.locator('[data-type="workflow-scope-selector"]')
    await expect(workflowSelector).toBeVisible()

    await arrayPage.openAddDialog('rpc')

    const dialogScope = page.locator('[data-dialog-name="rpc"]')

    await selectRadixOption(page, {
      triggerTextPattern: /ssh|http|acp-local/i,
      optionText: 'HTTP',
      triggerScope: dialogScope,
    })

    await expect(page.locator('#url')).toBeVisible()
    await expect(workflowSelector).toBeVisible()
  })

  test('rapid select changes handle portal animation overlap correctly', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()
    await arrayPage.openAddDialog('rpc')

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
      optionText: 'ACP-LOCAL',
      triggerScope: dialogScope,
    })

    await expect(page.locator('#command')).toBeVisible()
    await expect(page.locator('#host')).not.toBeVisible()
    await expect(page.locator('#url')).not.toBeVisible()
  })

  test('HTTP option in protocol select does not collide with HTTP option in method select', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()
    await arrayPage.openAddDialog('rpc')

    const dialogScope = page.locator('[data-dialog-name="rpc"]')

    await selectRadixOption(page, {
      triggerTextPattern: /ssh|http|acp-local/i,
      optionText: 'HTTP',
      triggerScope: dialogScope,
    })

    await expect(page.locator('#url')).toBeVisible()

    await selectRadixOption(page, {
      triggerTextPattern: /GET|POST|PUT/i,
      optionText: 'POST',
      triggerScope: dialogScope,
    })

    const protocolTrigger = dialogScope.locator('[role="combobox"]').filter({ hasText: /http/i }).first()
    const methodTrigger = dialogScope.locator('[role="combobox"]').filter({ hasText: /POST/i }).first()

    await expect(protocolTrigger).toBeVisible()
    await expect(methodTrigger).toBeVisible()
  })

  test('dialog-scoped select fails gracefully when trigger not found in scope', async ({ page }) => {
    const arrayPage = new ArrayIntegrationPage(page)
    await arrayPage.goto()
    await arrayPage.openAddDialog('mcp')

    const mcpDialogScope = page.locator('[data-dialog-name="mcp"]')

    await expect(
      selectRadixOption(page, {
        triggerTextPattern: /ssh|http|acp-local/i,
        optionText: 'SSH',
        triggerScope: mcpDialogScope,
      }),
    ).rejects.toThrow(/Radix Select trigger not found/)
  })
})

import { test, expect } from '@playwright/test'
import { adminLogin, createWorkflow } from './utils'
import { WorkflowTreePage, NodeDetailPanelPage } from './page-objects'
import { TIMEOUTS } from './config/test-timeouts'

test.describe('Node detail panel — Settings section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workflows')
    await adminLogin(page)
    await createWorkflow(page)
    await page.getByTestId('create-first-node').click()

    const tree = new WorkflowTreePage(page)
    await tree.firstNode.waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })

    const rootId = await tree.rootNodeId()
    await tree.selectNode(rootId)

    const detail = new NodeDetailPanelPage(page)
    await detail.waitForComponent()
  })

  test('opens settings by default for non-prompt node', async ({ page }) => {
    const detail = new NodeDetailPanelPage(page)

    await expect(detail.settingsTrigger).toHaveAttribute('data-state', 'open')
  })

  test('displays title, command, action buttons and genie', async ({ page }) => {
    const detail = new NodeDetailPanelPage(page)

    await expect(detail.commandInput).toBeVisible()
    await expect(detail.executeButton).toBeVisible()
    await expect(detail.addChildButton).toBeVisible()
    await expect(detail.duplicateButton).toBeVisible()
    await expect(detail.deleteButton).toBeVisible()
    await expect(detail.genie).toBeVisible()
  })

  test('root node disables duplicate and delete buttons', async ({ page }) => {
    const detail = new NodeDetailPanelPage(page)

    await expect(detail.duplicateButton).toBeDisabled()
    await expect(detail.deleteButton).toBeDisabled()
  })

  test('non-root node enables duplicate and delete buttons', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const detail = new NodeDetailPanelPage(page)

    await detail.addChild()
    await tree.nodes.nth(1).waitFor({ state: 'visible', timeout: TIMEOUTS.UI_UPDATE })
    const childId = await tree.nodes.nth(1).getAttribute('data-node-id')
    await tree.selectNode(childId!)
    await detail.waitForComponent()

    await expect(detail.duplicateButton).toBeEnabled()
    await expect(detail.deleteButton).toBeEnabled()
  })

  test('collapses and expands settings via trigger toggle', async ({ page }) => {
    const detail = new NodeDetailPanelPage(page)

    expect(await detail.settingsState()).toBe('open')
    await expect(detail.commandInput).toBeVisible()

    await detail.toggleSettings()
    expect(await detail.settingsState()).toBe('closed')
    await expect(detail.commandInput).toBeHidden()

    await detail.toggleSettings()
    expect(await detail.settingsState()).toBe('open')
    await expect(detail.commandInput).toBeVisible()
  })
})

test.describe('Node detail panel — Preview section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workflows')
    await adminLogin(page)
    await createWorkflow(page)
    await page.getByTestId('create-first-node').click()

    const tree = new WorkflowTreePage(page)
    await tree.firstNode.waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })

    const rootId = await tree.rootNodeId()
    await tree.selectNode(rootId)

    const detail = new NodeDetailPanelPage(page)
    await detail.waitForComponent()
  })

  test('hides preview when command has no references', async ({ page }) => {
    const detail = new NodeDetailPanelPage(page)

    await expect(detail.previewSection).toBeHidden()
  })

  test('shows resolved text when command contains @@ref', async ({ page }) => {
    const detail = new NodeDetailPanelPage(page)

    await page.route('**/api/v2/execute/preview', async route => {
      if (route.request().method() !== 'POST') return route.continue()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ resolvedCommand: 'resolved preview output' }),
      })
    })

    await detail.fillCommand('use @@myRef here')

    await expect(detail.previewSection).toBeVisible({ timeout: TIMEOUTS.BACKEND_SYNC })
    await expect(detail.previewText).toContainText('resolved preview output')
  })

  test('shows resolved text when command contains ##hashref', async ({ page }) => {
    const detail = new NodeDetailPanelPage(page)

    await page.route('**/api/v2/execute/preview', async route => {
      if (route.request().method() !== 'POST') return route.continue()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ resolvedCommand: 'hashref resolved' }),
      })
    })

    await detail.fillCommand('use ##_myVar here')

    await expect(detail.previewSection).toBeVisible({ timeout: TIMEOUTS.BACKEND_SYNC })
    await expect(detail.previewText).toContainText('hashref resolved')
  })

  test('hides preview after removing refs from command', async ({ page }) => {
    const detail = new NodeDetailPanelPage(page)

    await page.route('**/api/v2/execute/preview', async route => {
      if (route.request().method() !== 'POST') return route.continue()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ resolvedCommand: 'resolved' }),
      })
    })

    await detail.fillCommand('@@ref')
    await expect(detail.previewSection).toBeVisible({ timeout: TIMEOUTS.BACKEND_SYNC })

    await detail.fillCommand('plain text no refs')
    await expect(detail.previewSection).toBeHidden()
  })

  test('shows error message when preview API fails', async ({ page }) => {
    const detail = new NodeDetailPanelPage(page)

    await page.route('**/api/v2/execute/preview', async route => {
      if (route.request().method() !== 'POST') return route.continue()
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
    })

    await detail.fillCommand('@@brokenRef')

    await expect(detail.previewError).toBeVisible({ timeout: TIMEOUTS.BACKEND_SYNC })
    await expect(detail.previewText).toBeHidden()
  })
})

test.describe('Node detail panel — Auto-collapse for prompt nodes', () => {
  const promptChildId = 'prompt-child'
  const regularChildId = 'regular-child'

  test.beforeEach(async ({ page }) => {
    await page.goto('/workflows')
    await adminLogin(page)
    await createWorkflow(page)
    await page.getByTestId('create-first-node').click()

    const tree = new WorkflowTreePage(page)
    const detail = new NodeDetailPanelPage(page)

    await tree.firstNode.waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })
    const rootId = await tree.rootNodeId()
    await tree.selectNode(rootId)
    await detail.waitForComponent()

    await page.route('**/api/v2/execute', async route => {
      if (route.request().method() !== 'POST') return route.continue()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          nodesChanged: [
            { id: rootId, title: 'Root', children: [promptChildId, regularChildId], prompts: [promptChildId] },
            { id: promptChildId, title: 'Prompt Child', parent: rootId, children: [] },
            { id: regularChildId, title: 'Regular Child', parent: rootId, children: [] },
          ],
        }),
      })
    })

    await detail.execute()
    await tree.nodeByTitle('Prompt Child').waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })
  })

  test('collapses settings and shows preview for prompt node', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const detail = new NodeDetailPanelPage(page)

    await tree.selectNode(promptChildId)
    await detail.waitForComponent()

    expect(await detail.settingsState()).toBe('closed')
    await expect(detail.previewSection).toBeVisible()
  })

  test('opens settings and hides preview for non-prompt sibling', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const detail = new NodeDetailPanelPage(page)

    await tree.selectNode(promptChildId)
    await detail.waitForComponent()
    expect(await detail.settingsState()).toBe('closed')

    await tree.selectNode(regularChildId)
    await detail.waitForComponent()
    expect(await detail.settingsState()).toBe('open')
    await expect(detail.previewSection).toBeHidden()
  })

  test('manually expands collapsed settings on prompt node', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const detail = new NodeDetailPanelPage(page)

    await tree.selectNode(promptChildId)
    await detail.waitForComponent()

    expect(await detail.settingsState()).toBe('closed')
    await expect(detail.commandInput).toBeHidden()

    await detail.toggleSettings()

    expect(await detail.settingsState()).toBe('open')
    await expect(detail.commandInput).toBeVisible()
    await expect(detail.executeButton).toBeVisible()
    await expect(detail.genie).toBeVisible()
  })

  test('prompt node without command shows title as preview fallback', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const detail = new NodeDetailPanelPage(page)

    await tree.selectNode(promptChildId)
    await detail.waitForComponent()

    await expect(detail.previewText).toContainText('Prompt Child')
  })
})

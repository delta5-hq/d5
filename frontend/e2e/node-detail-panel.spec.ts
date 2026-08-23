import { test, expect } from '@playwright/test'
import { adminLogin, createWorkflow } from './utils'
import { WorkflowTreePage, NodeDetailPanelPage } from './page-objects'
import { TIMEOUTS } from './config/test-timeouts'

test.describe('Node detail panel — pointB3 chat contract', () => {
  let tree: WorkflowTreePage
  let detail: NodeDetailPanelPage
  let rootId: string

  test.beforeEach(async ({ page }) => {
    await page.goto('/workflows')
    await adminLogin(page)
    await createWorkflow(page)
    await page.getByTestId('create-first-node').click()

    tree = new WorkflowTreePage(page)
    detail = new NodeDetailPanelPage(page)
    await tree.firstNode.waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })

    rootId = await tree.rootNodeId()
    await tree.selectNode(rootId)
    await detail.waitForComponent()
  })

  test('renders title, OUTPUT responder, then bottom COMMAND composer', async ({ page }) => {
    await expect(detail.outputSection).toBeVisible()
    await expect(detail.outputGenie).toBeVisible()
    await expect(detail.outputText).toContainText('Root Node')
    await expect(detail.outputStatusLine).toContainText('idle')
    await expect(detail.commandSection).toBeVisible()
    await expect(detail.commandInput).toBeVisible()
    await expect(detail.executeButton).toBeVisible()
    await expect(detail.renameButton).toBeVisible()

    const outputBox = await detail.outputSection.boundingBox()
    const commandBox = await detail.commandSection.boundingBox()
    expect(outputBox).not.toBeNull()
    expect(commandBox).not.toBeNull()
    expect(outputBox!.y).toBeLessThan(commandBox!.y)

    await expect(page.getByTestId('settings-trigger')).toHaveCount(0)
    await expect(page.getByTestId('preview-trigger')).toHaveCount(0)
    await expect(page.getByTestId('add-child-node-button')).toHaveCount(0)
  })

  test('keeps a command beyond 2,000 characters readable in the roomy composer', async () => {
    const command = `/chat ${'x'.repeat(2100)}`

    await detail.fillCommand(command)

    await expect(detail.commandInput).toHaveValue(command)
    await expect(detail.commandSection).toContainText(`${command.length.toLocaleString('en-US')} chars`)
    const composerBox = await detail.commandInput.boundingBox()
    expect(composerBox).not.toBeNull()
    expect(composerBox!.height).toBeGreaterThanOrEqual(180)
  })

  test('rejects plain text and enables a slash command with a semantic role chip', async () => {
    await detail.fillCommand('plain text is not executable')

    await expect(detail.validationMessage).toBeVisible()
    await expect(detail.executeButton).toBeDisabled()
    await expect(detail.commandRoleChip).toHaveCount(0)

    await detail.fillCommand('/chat hello')

    await expect(detail.validationMessage).toHaveCount(0)
    await expect(detail.commandRoleChip).toHaveText('/chat')
    await expect(detail.executeButton).toBeEnabled()
    await expect(detail.outputStatusLine).toContainText('/chat')
  })

  test('renames the selected node from the auto-title header', async () => {
    await detail.renameButton.click()
    const titleEditor = detail.root.locator('textarea:not([data-type="command-field"])')
    await expect(titleEditor).toBeVisible()

    await titleEditor.fill('Renamed Root')
    await titleEditor.blur()

    await expect(detail.root.getByTitle('Double-click to edit')).toHaveText('Renamed Root')
    await expect(tree.firstNode).toContainText('Renamed Root')
  })

  test('preserves root Add child through the aligned root-header action', async ({ page }) => {
    const rootHeader = page.getByTestId('workflow-root-header')
    await rootHeader.hover()
    await expect(rootHeader.getByTestId('root-add-child')).toBeVisible()

    await detail.addChild()

    await expect(tree.nodesAtDepth(1)).toHaveCount(1, { timeout: TIMEOUTS.UI_UPDATE })
  })

  test('keeps root Add child tappable at a compact viewport', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 720 })
    const rootHeader = page.getByTestId('workflow-root-header')
    const addChild = rootHeader.getByTestId('root-add-child')

    await expect(addChild).toBeVisible()
    await addChild.click()

    await expect(tree.nodesAtDepth(1)).toHaveCount(1, { timeout: TIMEOUTS.UI_UPDATE })
  })

  test('shows real busy and idle responder states around execution', async ({ page }) => {
    let releaseResponse: (() => void) | undefined
    const responseGate = new Promise<void>(resolve => {
      releaseResponse = resolve
    })

    await page.route('**/api/v2/execute', async route => {
      if (route.request().method() !== 'POST') return route.continue()
      await responseGate
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ nodesChanged: [] }),
      })
    })

    await detail.fillCommand('/chat hello')

    try {
      await detail.execute()
      await expect(detail.outputStatusLine).toContainText('busy', { timeout: TIMEOUTS.UI_UPDATE })
      await expect(detail.abortButton).toBeVisible()
    } finally {
      releaseResponse?.()
    }

    await expect(detail.outputStatusLine).toContainText('idle', { timeout: TIMEOUTS.BACKEND_SYNC })
    await expect(detail.abortButton).toHaveCount(0)
  })
})

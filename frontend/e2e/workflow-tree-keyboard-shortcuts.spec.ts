import { test, expect } from '@playwright/test'
import { adminLogin, createWorkflow } from './utils'
import { WorkflowTreePage } from './page-objects'
import { TIMEOUTS } from './config/test-timeouts'

test.describe('Workflow tree keyboard shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workflows')
    await adminLogin(page)
    await createWorkflow(page)
  })

  test('Tab creates a child under the selected node', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const { childIds } = await tree.createRootAndChildren(1, TIMEOUTS.BACKEND_SYNC)

    await tree.selectNode(childIds[0])
    await tree.treePanel.press('Tab')

    await expect(tree.nodesAtDepth(2)).toHaveCount(1, { timeout: TIMEOUTS.UI_UPDATE })
    await expect(tree.selectedNodes).toHaveCount(1)
    await expect(tree.nodesAtDepth(2).first()).toHaveAttribute('data-node-selected', 'true')
    await expect(tree.inlineTitleEditor(tree.nodesAtDepth(2).first())).toBeVisible()
  })

  test('Ctrl+N creates a sibling for the selected node', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const { childIds } = await tree.createRootAndChildren(1, TIMEOUTS.BACKEND_SYNC)

    await tree.selectNode(childIds[0])
    await tree.treePanel.press('ControlOrMeta+N')

    await expect(tree.nodesAtDepth(1)).toHaveCount(2, { timeout: TIMEOUTS.UI_UPDATE })
    await expect(tree.selectedNodes).toHaveCount(1)
    await expect(tree.nodesAtDepth(1).nth(1)).toHaveAttribute('data-node-selected', 'true')
  })

  test('Ctrl+D duplicates the selected node', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const { childIds } = await tree.createRootAndChildren(1, TIMEOUTS.BACKEND_SYNC)

    await tree.selectNode(childIds[0])
    await tree.treePanel.press('ControlOrMeta+D')

    await expect(tree.nodesAtDepth(1)).toHaveCount(2, { timeout: TIMEOUTS.UI_UPDATE })
    await expect(tree.selectedNodes).toHaveCount(1)
    await expect(tree.nodesAtDepth(1).nth(1)).toHaveAttribute('data-node-selected', 'true')
  })

  test('Enter starts inline title editing for the selected node', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const { rootId } = await tree.createRootAndChildren(0, TIMEOUTS.BACKEND_SYNC)

    await tree.selectNode(rootId)
    await tree.treePanel.press('Enter')

    await expect(tree.inlineTitleEditor(tree.node(rootId))).toBeVisible({ timeout: TIMEOUTS.UI_UPDATE })
  })
})

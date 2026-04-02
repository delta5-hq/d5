import { test, expect } from '@playwright/test'
import { adminLogin, createWorkflow } from './utils'
import { WorkflowTreePage, NodeDetailPanelPage } from './page-objects'
import { TIMEOUTS } from './config/test-timeouts'

test.describe('Workflow tree node deletion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workflows')
    await adminLogin(page)
    await createWorkflow(page)
  })

  test.describe('Keyboard deletion without confirmation dialog', () => {
    test('Delete and Backspace keys both remove selected child', async ({ page }) => {
      const tree = new WorkflowTreePage(page)

      const { childIds } = await tree.createRootAndChildren(2, TIMEOUTS.BACKEND_SYNC)

      await tree.selectNode(childIds[0])
      await tree.pressDelete()
      await expect(tree.node(childIds[0])).toHaveCount(0, { timeout: TIMEOUTS.UI_UPDATE })
      await expect(tree.confirmDialog).toHaveCount(0)

      await tree.selectNode(childIds[1])
      await tree.pressBackspace()
      await expect(tree.node(childIds[1])).toHaveCount(0, { timeout: TIMEOUTS.UI_UPDATE })
      await expect(tree.confirmDialog).toHaveCount(0)
    })

    test('selection advances to sibling after delete', async ({ page }) => {
      const tree = new WorkflowTreePage(page)
      const { childIds } = await tree.createRootAndChildren(2, TIMEOUTS.BACKEND_SYNC)

      await tree.selectNode(childIds[0])
      await tree.pressDelete()

      await expect(tree.node(childIds[0])).toHaveCount(0, { timeout: TIMEOUTS.UI_UPDATE })
      await expect(tree.node(childIds[1])).toBeVisible()
      await expect(tree.selectedNodes).toHaveCount(1)
      await expect(tree.node(childIds[1])).toHaveAttribute('data-node-selected', 'true')
    })

    test('root node immune to Delete key', async ({ page }) => {
      const tree = new WorkflowTreePage(page)
      const { rootId } = await tree.createRootAndChildren(0, TIMEOUTS.BACKEND_SYNC)

      await tree.selectNode(rootId)
      await tree.pressDelete()

      await expect(tree.node(rootId)).toBeVisible()
    })

    test('no-op when inline title editing is focused', async ({ page }) => {
      const tree = new WorkflowTreePage(page)
      const detail = new NodeDetailPanelPage(page)
      const { rootId, childIds } = await tree.createRootAndChildren(1, TIMEOUTS.BACKEND_SYNC)

      await tree.selectNode(childIds[0])
      await detail.waitForComponent()

      await tree.node(childIds[0]).dblclick()
      await expect(tree.node(childIds[0]).locator('input')).toBeFocused()

      await page.keyboard.press('Delete')

      await expect(tree.node(childIds[0])).toBeVisible()
      await expect(tree.node(rootId)).toBeVisible()
    })

    test('no-op when node is executing', async ({ page }) => {
      const tree = new WorkflowTreePage(page)
      const detail = new NodeDetailPanelPage(page)
      const { childIds } = await tree.createRootAndChildren(1, TIMEOUTS.BACKEND_SYNC)

      await tree.selectNode(childIds[0])
      await detail.waitForComponent()

      await page.route('**/api/v2/execute', async route => {
        if (route.request().method() !== 'POST') return route.continue()
        await new Promise(() => {})
      })

      await detail.fillCommand('/chatgpt test')
      await detail.execute()
      await expect(detail.executeButton).toBeDisabled()

      await tree.pressDelete()

      await expect(tree.node(childIds[0])).toBeVisible()
    })
  })

  test.describe('Toggle-select via Ctrl+Click', () => {
    test('Ctrl+Click adds node to selection', async ({ page }) => {
      const tree = new WorkflowTreePage(page)
      const { childIds } = await tree.createRootAndChildren(2, TIMEOUTS.BACKEND_SYNC)

      await tree.selectNode(childIds[0])
      await expect(tree.selectedNodes).toHaveCount(1)

      await tree.ctrlClickNode(childIds[1])
      await expect(tree.selectedNodes).toHaveCount(2)
      await expect(tree.node(childIds[0])).toHaveAttribute('data-node-selected', 'true')
      await expect(tree.node(childIds[1])).toHaveAttribute('data-node-selected', 'true')
    })

    test('Ctrl+Click deselects already-selected node', async ({ page }) => {
      const tree = new WorkflowTreePage(page)
      const { childIds } = await tree.createRootAndChildren(2, TIMEOUTS.BACKEND_SYNC)

      await tree.selectNode(childIds[0])
      await tree.ctrlClickNode(childIds[1])
      await expect(tree.selectedNodes).toHaveCount(2)

      await tree.ctrlClickNode(childIds[0])
      await expect(tree.selectedNodes).toHaveCount(1)
      await expect(tree.node(childIds[1])).toHaveAttribute('data-node-selected', 'true')
      await expect(tree.node(childIds[0])).not.toHaveAttribute('data-node-selected', 'true')
    })

    test('plain click clears multi-selection to single', async ({ page }) => {
      const tree = new WorkflowTreePage(page)
      const { childIds } = await tree.createRootAndChildren(3, TIMEOUTS.BACKEND_SYNC)

      await tree.selectNode(childIds[0])
      await tree.ctrlClickNode(childIds[1])
      await tree.ctrlClickNode(childIds[2])
      await expect(tree.selectedNodes).toHaveCount(3)

      await tree.selectNode(childIds[1])
      await expect(tree.selectedNodes).toHaveCount(1)
      await expect(tree.node(childIds[1])).toHaveAttribute('data-node-selected', 'true')
    })

    test('bulk Delete removes all Ctrl-selected nodes', async ({ page }) => {
      const tree = new WorkflowTreePage(page)
      const { rootId, childIds } = await tree.createRootAndChildren(3, TIMEOUTS.BACKEND_SYNC)

      await tree.selectNode(childIds[0])
      await tree.ctrlClickNode(childIds[1])
      await expect(tree.selectedNodes).toHaveCount(2)

      await tree.pressDelete()

      await expect(tree.node(childIds[0])).toHaveCount(0, { timeout: TIMEOUTS.UI_UPDATE })
      await expect(tree.node(childIds[1])).toHaveCount(0)
      await expect(tree.node(childIds[2])).toBeVisible()
      await expect(tree.node(rootId)).toBeVisible()
      await expect(tree.confirmDialog).toHaveCount(0)
    })

    test('root node survives bulk delete when included in selection', async ({ page }) => {
      const tree = new WorkflowTreePage(page)
      const { rootId, childIds } = await tree.createRootAndChildren(2, TIMEOUTS.BACKEND_SYNC)

      await tree.selectNode(rootId)
      await tree.ctrlClickNode(childIds[0])
      await expect(tree.selectedNodes).toHaveCount(2)

      await tree.pressDelete()
      await tree.confirmDelete()

      await expect(tree.node(rootId)).toBeVisible()
      await expect(tree.node(childIds[0])).toHaveCount(0, { timeout: TIMEOUTS.UI_UPDATE })
    })

    test('parent+child deduplication in bulk delete', async ({ page }) => {
      const tree = new WorkflowTreePage(page)
      const detail = new NodeDetailPanelPage(page)

      const { rootId, childIds } = await tree.createRootAndChildren(1, TIMEOUTS.BACKEND_SYNC)
      const childA = childIds[0]

      await tree.selectNode(childA)
      await detail.waitForComponent()
      await detail.addChild()
      await tree.treePanel.press('Escape')

      await tree.toggleNodeExpand(childA)
      await expect(tree.nodes).toHaveCount(3, { timeout: TIMEOUTS.BACKEND_SYNC })

      const grandchildId = await tree.nodeIdAt(2)

      await tree.selectNode(childA)
      await tree.ctrlClickNode(grandchildId)
      await expect(tree.selectedNodes).toHaveCount(2)

      await tree.pressDelete()
      await tree.confirmDelete()

      await expect(tree.node(childA)).toHaveCount(0, { timeout: TIMEOUTS.UI_UPDATE })
      await expect(tree.node(grandchildId)).toHaveCount(0)
      await expect(tree.node(rootId)).toBeVisible()
    })
  })

  test.describe('Range-select via Shift+Click', () => {
    test('Shift+Click selects contiguous range', async ({ page }) => {
      const tree = new WorkflowTreePage(page)
      const { childIds } = await tree.createRootAndChildren(3, TIMEOUTS.BACKEND_SYNC)

      await tree.selectNode(childIds[0])
      await tree.shiftClickNode(childIds[2])

      await expect(tree.selectedNodes).toHaveCount(3)
      await expect(tree.node(childIds[0])).toHaveAttribute('data-node-selected', 'true')
      await expect(tree.node(childIds[1])).toHaveAttribute('data-node-selected', 'true')
      await expect(tree.node(childIds[2])).toHaveAttribute('data-node-selected', 'true')
    })

    test('Shift+Click adjusts range endpoint', async ({ page }) => {
      const tree = new WorkflowTreePage(page)
      const { childIds } = await tree.createRootAndChildren(3, TIMEOUTS.BACKEND_SYNC)

      await tree.selectNode(childIds[0])
      await tree.shiftClickNode(childIds[2])
      await expect(tree.selectedNodes).toHaveCount(3)

      await tree.shiftClickNode(childIds[1])
      await expect(tree.selectedNodes).toHaveCount(2)
      await expect(tree.node(childIds[0])).toHaveAttribute('data-node-selected', 'true')
      await expect(tree.node(childIds[1])).toHaveAttribute('data-node-selected', 'true')
      await expect(tree.node(childIds[2])).not.toHaveAttribute('data-node-selected', 'true')
    })

    test('range-selected nodes bulk-deleted via Delete key', async ({ page }) => {
      const tree = new WorkflowTreePage(page)
      const { rootId, childIds } = await tree.createRootAndChildren(3, TIMEOUTS.BACKEND_SYNC)

      await tree.selectNode(childIds[0])
      await tree.shiftClickNode(childIds[1])
      await expect(tree.selectedNodes).toHaveCount(2)

      await tree.pressDelete()

      await expect(tree.node(childIds[0])).toHaveCount(0, { timeout: TIMEOUTS.UI_UPDATE })
      await expect(tree.node(childIds[1])).toHaveCount(0)
      await expect(tree.node(childIds[2])).toBeVisible()
      await expect(tree.node(rootId)).toBeVisible()
      await expect(tree.confirmDialog).toHaveCount(0)
    })
  })
})

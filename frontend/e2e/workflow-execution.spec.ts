import { test, expect } from '@playwright/test'
import { adminLogin, createWorkflow } from './utils'
import { WorkflowTreePage, NodeDetailPanelPage } from './page-objects'
import { TIMEOUTS } from './config/test-timeouts'

test.describe('Workflow execution merge pipeline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workflows')
    await adminLogin(page)
    await createWorkflow(page)
  })

  test('merges array-format backend response into tree', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const detail = new NodeDetailPanelPage(page)

    await page.getByTestId('create-first-node').click()
    await tree.firstNode.waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })

    const rootId = await tree.rootNodeId()
    await tree.selectNode(rootId)
    await detail.waitForComponent()

    await expect(detail.childrenCount).toHaveText('0')

    await page.route('**/api/v2/execute', async route => {
      if (route.request().method() !== 'POST') return route.continue()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          nodesChanged: [
            { id: 'gen-alpha', title: 'Generated Alpha', parent: rootId, children: [] },
            { id: 'gen-beta', title: 'Generated Beta', parent: rootId, children: [] },
          ],
        }),
      })
    })

    await detail.execute()

    await expect(tree.nodeByTitle('Generated Alpha')).toBeVisible({ timeout: TIMEOUTS.BACKEND_SYNC })
    await expect(tree.nodeByTitle('Generated Beta')).toBeVisible()
    await expect(detail.childrenCount).toHaveText('2')
    expect(await tree.nodeCount()).toBe(3)
  })

  test('preserves existing children when merging new siblings', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const detail = new NodeDetailPanelPage(page)

    await page.getByTestId('create-first-node').click()
    await tree.firstNode.waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })

    const rootId = await tree.rootNodeId()
    await tree.selectNode(rootId)
    await detail.waitForComponent()
    await detail.addChild()

    await tree.nodes.nth(1).waitFor({ state: 'visible', timeout: TIMEOUTS.UI_UPDATE })
    const existingChildId = await tree.nodes.nth(1).getAttribute('data-node-id')

    await tree.selectNode(rootId)
    await detail.waitForComponent()
    await expect(detail.childrenCount).toHaveText('1')

    await page.route('**/api/v2/execute', async route => {
      if (route.request().method() !== 'POST') return route.continue()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          nodesChanged: [
            { id: 'gen-new', title: 'Newly Generated', parent: rootId, children: [] },
          ],
        }),
      })
    })

    await detail.execute()

    await expect(tree.nodeByTitle('Newly Generated')).toBeVisible({ timeout: TIMEOUTS.BACKEND_SYNC })
    await expect(tree.node(existingChildId!)).toBeVisible()
    await expect(detail.childrenCount).toHaveText('2')
    expect(await tree.nodeCount()).toBe(3)
  })

  test('reconciles parent-child links from orphaned backend response', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const detail = new NodeDetailPanelPage(page)

    await page.getByTestId('create-first-node').click()
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
            { id: rootId, title: 'Root Updated', children: [] },
            { id: 'orphan-1', title: 'Orphan Reconciled', parent: rootId, children: [] },
          ],
        }),
      })
    })

    await detail.execute()

    await expect(tree.nodeByTitle('Orphan Reconciled')).toBeVisible({ timeout: TIMEOUTS.BACKEND_SYNC })
    await expect(detail.childrenCount).toHaveText('1')
  })
})

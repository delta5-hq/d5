import { test, expect, type Page } from '@playwright/test'
import { adminLogin, createWorkflow } from './utils'
import { WorkflowTreePage, NodeDetailPanelPage } from './page-objects'
import { TIMEOUTS } from './config/test-timeouts'

async function seedWorkflowWithText(page: Page, workflowId: string) {
  await page.evaluate(async id => {
    const nodes = {
      root: {
        id: 'root',
        title: 'First paragraph\n\nSecond paragraph',
        children: ['old-prompt'],
        prompts: ['old-prompt'],
      },
      'old-prompt': {
        id: 'old-prompt',
        title: 'Old prompt',
        parent: 'root',
        children: [],
      },
    }

    const response = await fetch(`/api/v2/workflow/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'First paragraph', nodes, edges: {}, root: 'root' }),
    })

    if (!response.ok) throw new Error(`Seed failed: ${response.status}`)
  }, workflowId)

  await page.goto(`/workflow/${workflowId}`)
}

test.describe('Workflow prompt node behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workflows')
    await adminLogin(page)
  })

  test('rendering text to map creates muted prompt children and replaces previous prompts', async ({ page }) => {
    const workflowId = await createWorkflow(page)
    await seedWorkflowWithText(page, workflowId)

    const tree = new WorkflowTreePage(page)
    const detail = new NodeDetailPanelPage(page)

    await tree.node('root').waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })
    await tree.selectNode('root')
    await detail.waitForComponent()
    await detail.importTextAsPrompts()

    await expect(tree.node('old-prompt')).toHaveCount(0, { timeout: TIMEOUTS.UI_UPDATE })
    await expect(tree.nodesAtDepth(1)).toHaveCount(2)
    const firstPrompt = tree.nodesAtDepth(1).filter({ hasText: /^First paragraph$/ })
    const secondPrompt = tree.nodesAtDepth(1).filter({ hasText: /^Second paragraph$/ })

    await expect(firstPrompt).toHaveAttribute('data-prompt-node', 'true')
    await expect(firstPrompt).toHaveClass(/opacity-60/)
    await expect(secondPrompt).toHaveAttribute('data-prompt-node', 'true')
    await expect(secondPrompt).toHaveClass(/opacity-60/)
  })
})

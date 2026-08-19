import { test, expect, type Page } from '@playwright/test'
import { adminLogin, createWorkflow } from './utils'
import { WorkflowTreePage } from './page-objects'
import { TIMEOUTS } from './config/test-timeouts'

async function seedWorkflow(
  page: Page,
  workflowId: string,
  nodes: Record<string, unknown>,
  root: string,
): Promise<void> {
  await page.evaluate(
    async ({ id, seededNodes, seededRoot }) => {
      const response = await fetch(`/api/v2/workflow/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Seed', nodes: seededNodes, edges: {}, root: seededRoot }),
      })
      if (!response.ok) throw new Error(`Seed failed: ${response.status}`)
    },
    { id: workflowId, seededNodes: nodes, seededRoot: root },
  )
  await page.goto(`/workflow/${workflowId}`)
}

test.describe('Commandless text node renders to map on expand', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workflows')
    await adminLogin(page)
  })

  test('expanding a commandless text node splits its title into a prompt map with hierarchy', async ({ page }) => {
    const workflowId = await createWorkflow(page)
    await seedWorkflow(
      page,
      workflowId,
      {
        root: {
          id: 'root',
          title: 'First paragraph\n\nOutline\n  sub a\n  sub b',
          collapsed: true,
          children: [],
        },
      },
      'root',
    )

    const tree = new WorkflowTreePage(page)
    await tree.node('root').waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })
    await tree.toggleNodeExpand('root')

    await expect(tree.nodesAtDepth(1)).toHaveCount(2, { timeout: TIMEOUTS.UI_UPDATE })
    const firstPrompt = tree.nodeAtDepthByTitle(1, 'First paragraph')
    const outlinePrompt = tree.nodeAtDepthByTitle(1, 'Outline')
    await expect(firstPrompt).toHaveAttribute('data-prompt-node', 'true')
    await expect(outlinePrompt).toHaveAttribute('data-prompt-node', 'true')

    const outlineId = await outlinePrompt.getAttribute('data-node-id')
    if (!outlineId) throw new Error('Outline prompt node has no id')
    await tree.toggleNodeExpand(outlineId)

    await expect(tree.nodeAtDepthByTitle(2, 'sub a')).toHaveCount(1)
    await expect(tree.nodeAtDepthByTitle(2, 'sub b')).toHaveCount(1)
    await expect(tree.nodeAtDepthByTitle(2, 'sub a')).not.toHaveAttribute('data-prompt-node', 'true')
  })

  test('re-expanding does not rebuild over the user existing children', async ({ page }) => {
    const workflowId = await createWorkflow(page)
    await seedWorkflow(
      page,
      workflowId,
      {
        root: {
          id: 'root',
          title: 'First paragraph\n\nSecond paragraph',
          collapsed: true,
          children: ['kept'],
          prompts: ['kept'],
        },
        kept: { id: 'kept', title: 'Edited by user', parent: 'root', children: [] },
      },
      'root',
    )

    const tree = new WorkflowTreePage(page)
    await tree.node('root').waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })
    await tree.toggleNodeExpand('root')

    await expect(tree.node('kept')).toBeVisible()
    await expect(tree.nodeAtDepthByTitle(1, 'Edited by user')).toHaveCount(1)
    await expect(tree.nodeAtDepthByTitle(1, 'First paragraph')).toHaveCount(0)
    await expect(tree.nodeAtDepthByTitle(1, 'Second paragraph')).toHaveCount(0)
    await expect(tree.nodesAtDepth(1)).toHaveCount(1)
  })
})

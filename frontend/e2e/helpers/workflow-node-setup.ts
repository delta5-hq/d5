import type { Page } from '@playwright/test'
import { WorkflowTreePage, NodeDetailPanelPage } from '../page-objects'
import { TIMEOUTS } from '../config/test-timeouts'

export interface WorkflowNodeSetupResult {
  rootNodeId: string
  tree: WorkflowTreePage
  detail: NodeDetailPanelPage
}

export async function setupWorkflowWithNode(page: Page): Promise<WorkflowNodeSetupResult> {
  await page.getByTestId('create-first-node').click()

  const tree = new WorkflowTreePage(page)
  await tree.firstNode.waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })

  const rootNodeId = await tree.rootNodeId()
  await tree.selectNode(rootNodeId)

  const detail = new NodeDetailPanelPage(page)
  await detail.waitForComponent()

  return { rootNodeId, tree, detail }
}

export async function setupWorkflowWithCommandField(page: Page): Promise<WorkflowNodeSetupResult> {
  const result = await setupWorkflowWithNode(page)
  await page.locator('textarea[data-type="command-field"]').waitFor({ state: 'visible' })
  return result
}

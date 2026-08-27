import type { Page } from '@playwright/test'
import { WorkflowTreePage, NodeDetailPanelPage } from '../page-objects'
import { TIMEOUTS } from '../config/test-timeouts'

export interface WorkflowNodeSetupResult {
  rootNodeId: string
  tree: WorkflowTreePage
  detail: NodeDetailPanelPage
}

export async function setupWorkflowWithNode(page: Page): Promise<WorkflowNodeSetupResult> {
  const tree = new WorkflowTreePage(page)
  const createButton = page.getByTestId('create-first-node')

  // Workflow may already contain a root node from a previous setup (e.g., after page.reload()
  // mid-test). Race the create-first-node button vs an existing first node, then act on
  // whichever appears. If the node already exists, skip the click; otherwise click to create.
  await Promise.race([
    createButton.waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC }),
    tree.firstNode.waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC }),
  ])
  if (!(await tree.firstNode.isVisible())) {
    await createButton.click()
    await tree.firstNode.waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })
  }

  const rootNodeId = await tree.rootNodeId()
  await tree.selectNode(rootNodeId)

  const detail = new NodeDetailPanelPage(page)
  await detail.waitForComponent()

  return { rootNodeId, tree, detail }
}

export async function setupWorkflowWithCommandField(page: Page): Promise<WorkflowNodeSetupResult> {
  const result = await setupWorkflowWithNode(page)
  await page.locator('textarea[data-type="command-field"]').waitFor({ state: 'visible' })
  await page.getByText('Saved', { exact: true }).waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })
  return result
}

export async function getExistingWorkflowSetup(page: Page): Promise<WorkflowNodeSetupResult> {
  const tree = new WorkflowTreePage(page)
  await tree.firstNode.waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })

  const rootNodeId = await tree.rootNodeId()
  await tree.selectNode(rootNodeId)

  const detail = new NodeDetailPanelPage(page)
  await detail.waitForComponent()
  await page.locator('textarea[data-type="command-field"]').waitFor({ state: 'visible' })

  return { rootNodeId, tree, detail }
}

export async function reloadAndGetExistingSetup(page: Page): Promise<WorkflowNodeSetupResult> {
  await page.reload()
  return getExistingWorkflowSetup(page)
}

import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { WorkflowTreePage, NodeDetailPanelPage } from '../page-objects'
import { TIMEOUTS } from '../config/test-timeouts'
import { awaitExecutionCompleted } from './execution-waits'

export async function nodeTitle(page: Page, nodeId: string): Promise<string> {
  const text = await page.locator(`[data-node-id="${nodeId}"]`).textContent()
  return text?.trim() ?? ''
}

// The reliability suffix renders a beat after awaitExecutionCompleted resolves,
// so reading the title once races the render under parallel load. Poll the title
// until it matches the expected completion pattern, then return the stable value.
export async function awaitNodeTitle(
  page: Page,
  nodeId: string,
  pattern: RegExp,
  timeout: number = TIMEOUTS.BACKEND_SYNC,
): Promise<string> {
  await expect
    .poll(() => nodeTitle(page, nodeId), {
      timeout,
      message: `node ${nodeId} title did not match ${pattern}`,
    })
    .toMatch(pattern)
  return nodeTitle(page, nodeId)
}

export async function selectRootAndOpenDetail(page: Page) {
  const tree = new WorkflowTreePage(page)
  const detail = new NodeDetailPanelPage(page)
  const rootId = await tree.rootNodeId()
  await tree.selectNode(rootId)
  await detail.waitForComponent()
  return { tree, detail, rootId }
}

export async function addChildCommand(
  page: Page,
  tree: WorkflowTreePage,
  parentId: string,
  command: string,
): Promise<string> {
  await tree.selectNode(parentId)
  const parentDetail = new NodeDetailPanelPage(page)
  await parentDetail.waitForComponent()
  const childIndex = await tree.nodes.count()
  await parentDetail.addChild()
  await tree.nodes.nth(childIndex).waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })

  const childId = await tree.nodeIdAt(childIndex)
  await tree.selectNode(childId)
  const childDetail = new NodeDetailPanelPage(page)
  await childDetail.waitForComponent()
  await childDetail.fillCommand(command)
  return childId
}

export async function executeAndWaitForCompletion(
  page: Page,
  detail: NodeDetailPanelPage,
): Promise<void> {
  await detail.execute()
  await awaitExecutionCompleted(page)
}

export async function executeRoot(page: Page, tree: WorkflowTreePage, rootId: string): Promise<void> {
  await tree.selectNode(rootId)
  const rootDetail = new NodeDetailPanelPage(page)
  await rootDetail.waitForComponent()
  await executeAndWaitForCompletion(page, rootDetail)
}

export async function executeCommodityCommand(page: Page, command: string) {
  const tree = new WorkflowTreePage(page)
  const { detail, rootId } = await selectRootAndOpenDetail(page)
  await detail.fillCommand(command)
  await executeAndWaitForCompletion(page, detail)
  await expect(tree.nodes.first()).toBeVisible({ timeout: TIMEOUTS.BACKEND_SYNC })
  return { tree, rootId }
}

import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'
import { WorkflowTreePage, NodeDetailPanelPage } from '../page-objects'
import { TIMEOUTS } from '../config/test-timeouts'

export interface CommandExecutionResult {
  childNode: Locator
}

export async function executeCommandAndAwaitOutput(
  tree: WorkflowTreePage,
  detail: NodeDetailPanelPage,
  rootNodeId: string,
  command: string,
  expectedOutputText: string,
  timeout: number = TIMEOUTS.BACKEND_SYNC,
): Promise<CommandExecutionResult> {
  await tree.selectNode(rootNodeId)
  await detail.waitForComponent()
  await detail.fillCommand(command)
  await detail.execute()

  const childNode = tree.nodeByTitle(expectedOutputText)
  await expect(childNode).toBeVisible({ timeout })

  return { childNode }
}

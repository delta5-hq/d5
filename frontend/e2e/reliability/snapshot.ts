import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export type WorkflowNodeSnapshot = {
  title?: string
  parent?: string
}

export type WorkflowSnapshot = {
  nodes?: Record<string, WorkflowNodeSnapshot>
}

export async function loadWorkflowSnapshot(page: Page): Promise<WorkflowSnapshot> {
  const workflowId = new URL(page.url()).pathname.split('/').filter(Boolean).pop()
  // The workflow GET races the backend-v2 persist under parallel load; a single
  // non-retrying fetch intermittently returns non-ok. Poll until it succeeds.
  let body: WorkflowSnapshot | undefined
  await expect
    .poll(
      async () => {
        const response = await page.request.get(`/api/v2/workflow/${workflowId}`)
        if (!response.ok()) return false
        body = await response.json()
        return true
      },
      { timeout: 15000, message: `workflow ${workflowId} fetch did not return ok` },
    )
    .toBe(true)
  return body as WorkflowSnapshot
}

export async function persistedChildTitles(page: Page, parentId: string): Promise<string[]> {
  const snapshot = await loadWorkflowSnapshot(page)
  return Object.values(snapshot.nodes ?? {})
    .filter(node => node.parent === parentId)
    .map(node => String(node.title ?? ''))
}

export function validateTitlesOwnedByIterations(
  workflow: WorkflowSnapshot,
  criterionMarker: string,
  iterationIds: string[],
): string[] {
  const iterationIdSet = new Set(iterationIds)
  return Object.values(workflow.nodes ?? {})
    .filter(node => {
      const title = String(node.title ?? '')
      return title.includes(criterionMarker) && iterationIdSet.has(node.parent ?? '')
    })
    .map(node => String(node.title ?? ''))
}

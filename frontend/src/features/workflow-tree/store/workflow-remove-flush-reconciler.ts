import type { DebouncedPersister } from './workflow-store-persistence'
import type { ReadWorkflowFn } from './workflow-store-types'

const MAX_FLUSH_ATTEMPTS = 3
const RETRY_DELAY_MS = 100

export interface RemoveFlushReconcilerDeps {
  persister: DebouncedPersister
  workflowId: string
  readWorkflow: ReadWorkflowFn
  removedFileIds: readonly string[]
  onDanglingLinkSurvived: () => void
}

async function serverHasNoDanglingLinks(
  workflowId: string,
  fileIds: readonly string[],
  readWorkflow: ReadWorkflowFn,
): Promise<boolean> {
  const removedSet = new Set(fileIds)
  try {
    const { nodes } = await readWorkflow(workflowId)
    return !Object.values(nodes).some(node => node.file && removedSet.has(node.file))
  } catch {
    return false
  }
}

export async function reconcileRemoveFlush({
  persister,
  workflowId,
  readWorkflow,
  removedFileIds,
  onDanglingLinkSurvived,
}: RemoveFlushReconcilerDeps): Promise<void> {
  for (let attempt = 0; attempt < MAX_FLUSH_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise<void>(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt))
    }
    if (await persister.flush()) return
  }

  const clean = await serverHasNoDanglingLinks(workflowId, removedFileIds, readWorkflow)
  if (!clean) onDanglingLinkSurvived()
}

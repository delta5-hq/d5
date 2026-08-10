import type { NodeData, NodeId } from '@shared/base-types'
import { classifyIntegrationError } from '@shared/lib/integration-api-error'

export interface AttachmentReference {
  nodeId: NodeId
  fileId: string
}

export interface AttachmentLifecycleDeps {
  workflowId: string
  deleteFile: (workflowId: string, fileId: string) => Promise<void>
  onError: (code: string) => void
}

export function collectAttachmentReferences(
  nodes: Record<NodeId, NodeData>,
  nodeIds: readonly NodeId[] | Set<NodeId>,
): AttachmentReference[] {
  const references: AttachmentReference[] = []
  const seenFiles = new Set<string>()

  for (const nodeId of nodeIds) {
    const fileId = nodes[nodeId]?.file
    if (!fileId || seenFiles.has(fileId)) continue
    seenFiles.add(fileId)
    references.push({ nodeId, fileId })
  }

  return references
}

export async function deleteAttachmentFiles(
  deps: AttachmentLifecycleDeps,
  references: readonly AttachmentReference[],
): Promise<boolean> {
  for (const reference of references) {
    try {
      await deps.deleteFile(deps.workflowId, reference.fileId)
    } catch (err) {
      if (classifyIntegrationError(err) === 'not_found') continue
      deps.onError('workflowTree.attachment.deleteFailed')
      return false
    }
  }
  return true
}

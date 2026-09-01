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
  const removedIds = nodeIds instanceof Set ? nodeIds : new Set(nodeIds)
  const survivingFileIds = new Set(
    Object.values(nodes)
      .filter(node => !removedIds.has(node.id))
      .map(node => node.file)
      .filter((fileId): fileId is string => Boolean(fileId)),
  )

  for (const nodeId of removedIds) {
    const fileId = nodes[nodeId]?.file
    if (!fileId || seenFiles.has(fileId) || survivingFileIds.has(fileId)) continue
    seenFiles.add(fileId)
    references.push({ nodeId, fileId })
  }

  return references
}

export async function deleteAttachmentFiles(
  deps: AttachmentLifecycleDeps,
  references: readonly AttachmentReference[],
): Promise<boolean> {
  let allDeleted = true
  for (const reference of references) {
    try {
      await deps.deleteFile(deps.workflowId, reference.fileId)
    } catch (err) {
      if (classifyIntegrationError(err) === 'not_found') continue
      allDeleted = false
    }
  }
  if (!allDeleted) deps.onError('workflowTree.attachment.deleteFailed')
  return allDeleted
}

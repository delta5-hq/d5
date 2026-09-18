export interface FileDropTargetInput {
  eventTarget?: Element | null
  pointTarget?: Element | null
  rootId?: string
  hasNode: (nodeId: string) => boolean
}

function nodeIdFromElement(element?: Element | null): string | undefined {
  return element?.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId
}

export function resolveWorkflowFileDropParentId(input: FileDropTargetInput): string | undefined {
  const eventTargetId = nodeIdFromElement(input.eventTarget)
  if (eventTargetId && input.hasNode(eventTargetId)) return eventTargetId

  const pointTargetId = nodeIdFromElement(input.pointTarget)
  if (pointTargetId && input.hasNode(pointTargetId)) return pointTargetId

  return input.rootId
}

import type { NodeData, NodeId } from '@shared/base-types'

const STEP_PREFIX_RE = /^#(\d+)\s*/

export function isStepsNode(node: NodeData): boolean {
  return node.command?.trim() === '/steps'
}

export function parseStepIndex(title: string): number | null {
  const match = STEP_PREFIX_RE.exec(title)
  return match ? parseInt(match[1], 10) : null
}

export function stripStepPrefix(title: string): string {
  return title.replace(STEP_PREFIX_RE, '')
}

export function applyStepPrefix(title: string, n: number): string {
  return `#${n} ${stripStepPrefix(title)}`
}

export function sortChildrenByStepPrefix(children: NodeId[], nodes: Record<NodeId, NodeData>): NodeId[] {
  const prefixed: Array<{ id: NodeId; index: number; originalPosition: number }> = []
  const unprefixed: NodeId[] = []

  children.forEach((id, i) => {
    const stepIndex = parseStepIndex(nodes[id]?.title ?? '')
    if (stepIndex !== null) {
      prefixed.push({ id, index: stepIndex, originalPosition: i })
    } else {
      unprefixed.push(id)
    }
  })

  prefixed.sort((a, b) => a.index - b.index || a.originalPosition - b.originalPosition)
  return [...prefixed.map(x => x.id), ...unprefixed]
}

export function applySequentialPrefixes(nodes: Record<NodeId, NodeData>, parentId: NodeId): Record<NodeId, NodeData> {
  const parent = nodes[parentId]
  if (!parent || !isStepsNode(parent)) return nodes

  const children = parent.children ?? []
  if (children.length === 0) return nodes

  const updated = { ...nodes }
  children.forEach((childId, i) => {
    const child = updated[childId]
    if (child) {
      updated[childId] = { ...child, title: applyStepPrefix(child.title ?? '', i + 1) }
    }
  })
  return updated
}

export function reorderAndRenumberStepsChildren(
  nodes: Record<NodeId, NodeData>,
  parentId: NodeId,
): Record<NodeId, NodeData> {
  const parent = nodes[parentId]
  if (!parent || !isStepsNode(parent)) return nodes

  const sortedChildren = sortChildrenByStepPrefix(parent.children ?? [], nodes)
  const withSortedParent: Record<NodeId, NodeData> = {
    ...nodes,
    [parentId]: { ...parent, children: sortedChildren },
  }
  return applySequentialPrefixes(withSortedParent, parentId)
}

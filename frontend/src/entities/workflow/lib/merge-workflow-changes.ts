import type { WorkflowContentData, NodeData, EdgeData } from '@shared/base-types'

interface ExecuteChanges {
  nodesChanged?: Record<string, NodeData>
  edgesChanged?: Record<string, EdgeData>
}

function mergeNode(existing: NodeData, incoming: NodeData): NodeData {
  const existingChildren = existing.children ?? []
  const incomingChildren = incoming.children ?? []

  if (!existingChildren.length && !incomingChildren.length) return incoming

  const unionChildren = [...new Set([...existingChildren, ...incomingChildren])]
  return { ...incoming, children: unionChildren }
}

function reconcileParentChildren(nodes: Record<string, NodeData>, incomingIds: string[]): Record<string, NodeData> {
  const patches: Record<string, string[]> = {}

  for (const id of incomingIds) {
    const node = nodes[id]
    if (!node?.parent) continue
    const parent = nodes[node.parent]
    if (!parent) continue
    const existing = new Set(parent.children)
    if (existing.has(id)) continue
    ;(patches[node.parent] ??= []).push(id)
  }

  if (!Object.keys(patches).length) return nodes

  const result = { ...nodes }
  for (const [parentId, childIds] of Object.entries(patches)) {
    const parent = result[parentId]
    result[parentId] = { ...parent, children: [...(parent.children ?? []), ...childIds] }
  }
  return result
}

export const mergeWorkflowChanges = (current: WorkflowContentData, changes: ExecuteChanges): WorkflowContentData => {
  if (!changes.nodesChanged && !changes.edgesChanged) {
    return current
  }

  let nodes = current.nodes
  if (changes.nodesChanged) {
    const merged = { ...nodes }
    for (const [id, node] of Object.entries(changes.nodesChanged)) {
      const existing = merged[id]
      merged[id] = existing ? mergeNode(existing, node) : node
    }
    nodes = reconcileParentChildren(merged, Object.keys(changes.nodesChanged))
  }

  const edges = changes.edgesChanged ? { ...(current.edges ?? {}), ...changes.edgesChanged } : current.edges

  return {
    ...current,
    nodes,
    edges,
  }
}

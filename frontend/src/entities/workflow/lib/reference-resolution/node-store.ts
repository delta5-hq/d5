import type { NodeData, NodeId, EdgeId, EdgeData } from '@shared/base-types'

export type EnrichedNodeData = NodeData & { depth: number }

export interface NodeStore {
  _nodes: Record<NodeId, EnrichedNodeData>
  _edges: Record<EdgeId, EdgeData>
  getNode(id: NodeId): EnrichedNodeData | undefined
}

export function enrichNodesWithDepth(
  nodes: Record<NodeId, NodeData>,
  rootId: NodeId,
): Record<NodeId, EnrichedNodeData> {
  const enriched: Record<NodeId, EnrichedNodeData> = {}

  const queue: Array<{ id: NodeId; depth: number }> = [{ id: rootId, depth: 0 }]

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!
    const node = nodes[id]
    if (!node) continue

    enriched[id] = { ...node, depth }

    for (const childId of node.children ?? []) {
      if (!enriched[childId]) {
        queue.push({ id: childId, depth: depth + 1 })
      }
    }
  }

  for (const id of Object.keys(nodes)) {
    if (!enriched[id]) {
      enriched[id] = { ...nodes[id], depth: 0 }
    }
  }

  return enriched
}

export function makeNodeStore(
  nodes: Record<NodeId, NodeData>,
  edges: Record<EdgeId, EdgeData> = {},
  rootId?: NodeId,
): NodeStore {
  const root = rootId ?? Object.values(nodes).find(n => !n.parent)?.id
  const enrichedNodes = root ? enrichNodesWithDepth(nodes, root) : (nodes as Record<NodeId, EnrichedNodeData>)

  return {
    _nodes: enrichedNodes,
    _edges: edges,
    getNode(id) {
      return enrichedNodes[id]
    },
  }
}

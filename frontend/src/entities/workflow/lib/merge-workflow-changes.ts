import type { WorkflowContentData, NodeData, EdgeData } from '@shared/base-types'
import { hasValidTitleProjection, isTitleProjection, sanitizeTitleProjections } from './title-projection'

interface ExecuteChanges {
  nodesChanged?: Record<string, NodeData>
  edgesChanged?: Record<string, EdgeData>
}

function protectedProjectedPromptIds(existing: NodeData, nodes: Record<string, NodeData>): Readonly<Set<string>> {
  const projection = existing.titleProjection
  if (!isTitleProjection(projection)) return new Set()
  if (!hasValidTitleProjection(existing, nodes)) return new Set()

  const children = new Set(existing.children ?? [])
  const prompts = new Set(existing.prompts ?? [])
  return new Set(projection.childIds.filter(id => children.has(id) && prompts.has(id)))
}

function computeEvictedPromptIds(
  existing: NodeData,
  incoming: NodeData,
  nodes: Record<string, NodeData>,
): Readonly<Set<string>> {
  const existingPrompts = existing.prompts
  const incomingPrompts = incoming.prompts
  if (!existingPrompts?.length || incomingPrompts === undefined) return new Set()

  const retained = new Set(incomingPrompts)
  const protectedPrompts = protectedProjectedPromptIds(existing, nodes)
  const evicted = new Set<string>()
  for (const id of existingPrompts) {
    if (!retained.has(id) && !protectedPrompts.has(id)) evicted.add(id)
  }
  return evicted
}

function mergeChildren(
  existing: NodeData,
  incoming: NodeData,
  evictedPromptIds: Readonly<Set<string>>,
): string[] | undefined {
  const existingChildren = existing.children ?? []
  const incomingChildren = incoming.children ?? []
  if (existingChildren.length === 0 && incomingChildren.length === 0) return incoming.children

  const seen = new Set<string>()
  const merged: string[] = []
  for (const id of [...existingChildren, ...incomingChildren]) {
    if (!seen.has(id) && !evictedPromptIds.has(id)) {
      seen.add(id)
      merged.push(id)
    }
  }
  return merged
}

function mergeNode(
  existing: NodeData,
  incoming: NodeData,
  nodes: Record<string, NodeData>,
): { node: NodeData; evictedPromptIds: Readonly<Set<string>> } {
  const evictedPromptIds = computeEvictedPromptIds(existing, incoming, nodes)

  const mergedPrompts = incoming.prompts !== undefined ? incoming.prompts : existing.prompts
  const mergedTitleProjection =
    incoming.titleProjection !== undefined ? incoming.titleProjection : existing.titleProjection
  const mergedChildren = mergeChildren(existing, incoming, evictedPromptIds)

  const hasChildren = mergedChildren !== undefined
  const hasPrompts = mergedPrompts !== undefined
  const hasTitleProjection = mergedTitleProjection !== undefined

  if (!hasChildren && !hasPrompts && !hasTitleProjection) return { node: incoming, evictedPromptIds }

  const node: NodeData = { ...incoming }
  if (hasChildren) node.children = mergedChildren
  if (hasPrompts) node.prompts = mergedPrompts
  if (hasTitleProjection) node.titleProjection = mergedTitleProjection

  return { node, evictedPromptIds }
}

function collectDescendantsOf(nodes: Record<string, NodeData>, roots: Readonly<Set<string>>): Set<string> {
  const result = new Set<string>()
  const queue = [...roots]
  while (queue.length > 0) {
    const id = queue.pop()!
    if (result.has(id)) continue
    result.add(id)
    for (const childId of nodes[id]?.children ?? []) queue.push(childId)
  }
  return result
}

function purgeEvictedPromptSubtrees(
  nodes: Record<string, NodeData>,
  evictedIdsByParent: Map<string, Readonly<Set<string>>>,
): Record<string, NodeData> {
  if (evictedIdsByParent.size === 0) return nodes

  const evictedRoots = new Set<string>()
  for (const ids of evictedIdsByParent.values()) {
    for (const id of ids) evictedRoots.add(id)
  }

  const allEvicted = collectDescendantsOf(nodes, evictedRoots)
  if (allEvicted.size === 0) return nodes

  const result: Record<string, NodeData> = {}
  for (const [id, node] of Object.entries(nodes)) {
    if (!allEvicted.has(id)) result[id] = node
  }
  return result
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
    const evictedIdsByParent = new Map<string, Readonly<Set<string>>>()

    for (const [id, incoming] of Object.entries(changes.nodesChanged)) {
      const existing = merged[id]
      if (existing) {
        const { node, evictedPromptIds } = mergeNode(existing, incoming, current.nodes)
        merged[id] = node
        if (evictedPromptIds.size > 0) evictedIdsByParent.set(id, evictedPromptIds)
      } else {
        merged[id] = incoming
      }
    }

    const afterPurge = purgeEvictedPromptSubtrees(merged, evictedIdsByParent)
    nodes = sanitizeTitleProjections(reconcileParentChildren(afterPurge, Object.keys(changes.nodesChanged)))
  }

  const edges = changes.edgesChanged ? { ...(current.edges ?? {}), ...changes.edgesChanged } : current.edges

  return {
    ...current,
    nodes,
    edges,
  }
}

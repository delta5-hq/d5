import type { NodeData, NodeId } from '@shared/base-types'
import type { NodeStore } from './reference-resolution/node-store'
import { parseTextToPromptSeeds, type PromptSeed } from './text-to-prompts-splitter'

interface ExpectedProjectionNode {
  title: string
  parentIndex: number | undefined
  childIndices: number[]
}

const sameIds = (left: readonly NodeId[], right: readonly NodeId[]): boolean =>
  left.length === right.length && left.every((id, index) => id === right[index])

function expectedProjection(sourceTitle: string): {
  nodes: ExpectedProjectionNode[]
  rootIndices: number[]
} {
  const nodes: ExpectedProjectionNode[] = []

  const visit = (seed: PromptSeed, parentIndex: number | undefined): number => {
    const index = nodes.length
    const expected: ExpectedProjectionNode = { title: seed.title, parentIndex, childIndices: [] }
    nodes.push(expected)
    for (const child of seed.children) expected.childIndices.push(visit(child, index))
    return index
  }

  return {
    nodes,
    rootIndices: parseTextToPromptSeeds(sourceTitle).map(seed => visit(seed, undefined)),
  }
}

export function isTitleProjection(value: unknown): value is NonNullable<NodeData['titleProjection']> {
  if (value === null || typeof value !== 'object') return false
  const projection = value as Record<string, unknown>
  return (
    typeof projection.sourceTitle === 'string' &&
    Array.isArray(projection.childIds) &&
    projection.childIds.length > 0 &&
    projection.childIds.every(id => typeof id === 'string') &&
    Array.isArray(projection.nodeIds) &&
    projection.nodeIds.length > 0 &&
    projection.nodeIds.every(id => typeof id === 'string') &&
    new Set(projection.nodeIds).size === projection.nodeIds.length
  )
}

function hasValidProjection(node: NodeData, getNode: (id: NodeId) => NodeData | undefined): boolean {
  const projection = node.titleProjection
  if (!isTitleProjection(projection)) return false
  if ((node.title ?? '') !== projection.sourceTitle) return false

  const expected = expectedProjection(projection.sourceTitle)
  if (expected.nodes.length !== projection.nodeIds.length) return false

  const expectedRootIds = expected.rootIndices.map(index => projection.nodeIds[index])
  if (!sameIds(expectedRootIds, projection.childIds)) return false

  const projectedIds = new Set(projection.nodeIds)
  const directProjectedIds = (node.children ?? []).filter(id => projectedIds.has(id))
  if (!sameIds(directProjectedIds, projection.childIds)) return false

  for (let index = 0; index < expected.nodes.length; index += 1) {
    const expectedNode = expected.nodes[index]
    const projectedNode = getNode(projection.nodeIds[index])
    if (!projectedNode || projectedNode.title !== expectedNode.title) return false

    const expectedParentId =
      expectedNode.parentIndex === undefined ? node.id : projection.nodeIds[expectedNode.parentIndex]
    if (projectedNode.parent !== expectedParentId) return false

    const expectedChildIds = expectedNode.childIndices.map(childIndex => projection.nodeIds[childIndex])
    const actualProjectedChildIds = (projectedNode.children ?? []).filter(id => projectedIds.has(id))
    if (!sameIds(actualProjectedChildIds, expectedChildIds)) return false
  }

  return true
}

export function hasValidTitleProjection(node: NodeData, nodes: Record<NodeId, NodeData>): boolean {
  return hasValidProjection(node, id => nodes[id])
}

export function hasValidStoreTitleProjection(node: NodeData, store: NodeStore): boolean {
  return hasValidProjection(node, id => store.getNode(id))
}

export function withTitleProjection(
  node: NodeData,
  sourceTitle: string,
  childIds: NodeId[],
  nodeIds: NodeId[],
): NodeData {
  return childIds.length > 0 && nodeIds.length > 0
    ? { ...node, titleProjection: { sourceTitle, childIds, nodeIds } }
    : withoutTitleProjection(node)
}

export function withoutTitleProjection(node: NodeData): NodeData {
  if (!node.titleProjection) return node
  const next = { ...node }
  delete next.titleProjection
  return next
}

export function sanitizeTitleProjection(node: NodeData, nodes: Record<NodeId, NodeData>): NodeData {
  return hasValidTitleProjection(node, nodes) ? node : withoutTitleProjection(node)
}

export function sanitizeTitleProjections(nodes: Record<NodeId, NodeData>): Record<NodeId, NodeData> {
  let changed = false
  const result: Record<NodeId, NodeData> = {}
  for (const [id, node] of Object.entries(nodes)) {
    const sanitized = sanitizeTitleProjection(node, nodes)
    result[id] = sanitized
    if (sanitized !== node) changed = true
  }
  return changed ? result : nodes
}

export function remapTitleProjection(node: NodeData, idMapping: Record<NodeId, NodeId>): NodeData {
  const projection = node.titleProjection
  if (!isTitleProjection(projection)) return withoutTitleProjection(node)

  const childIds = projection.childIds.map(id => idMapping[id]).filter((id): id is NodeId => Boolean(id))
  const nodeIds = projection.nodeIds.map(id => idMapping[id]).filter((id): id is NodeId => Boolean(id))
  return childIds.length === projection.childIds.length && nodeIds.length === projection.nodeIds.length
    ? { ...node, titleProjection: { ...projection, childIds, nodeIds } }
    : withoutTitleProjection(node)
}

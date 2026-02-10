import type { NodeData } from '@/shared/base-types/workflow'
import type { TreeState } from '../core/types'
import type { Segment, SegmentNode, SegmentContainer, SegmentState, SegmentComputeOptions } from './types'

interface ContainerNodeConfig {
  type: string
  childrenIds?: string[]
  paddingTop?: number
  paddingBottom?: number
  includeParent?: boolean
}

function hasContainerConfig(node: unknown): node is { container: ContainerNodeConfig } {
  return Boolean(node && typeof node === 'object' && 'container' in node && node.container)
}

/* Synthetic container config for `/foreach` command nodes */
const FOREACH_CONTAINER_CONFIG: ContainerNodeConfig = {
  type: 'group',
  paddingTop: 6,
  paddingBottom: 6,
  includeParent: true,
}

/**
 * Returns the effective container config for a node — either the explicit
 * `node.container` or a synthetic one for recognised commands (e.g. `/foreach`).
 */
function getEffectiveContainerConfig(node: NodeData): ContainerNodeConfig | null {
  if (hasContainerConfig(node)) return node.container
  if (node.command === '/foreach') return FOREACH_CONTAINER_CONFIG
  return null
}

function isImmediateChild(nodeId: string, parentId: string, treeState: TreeState): boolean {
  const parentRecord = treeState.records[parentId]
  return Boolean(parentRecord?.data.node.children?.includes(nodeId))
}

export function computeSegments(treeState: TreeState, options: SegmentComputeOptions): SegmentState {
  const segments: Segment[] = []
  const segmentHeights: number[] = []
  const nodeToSegmentIndex = new Map<string, number>()
  const processedNodes = new Set<string>()

  for (let i = 0; i < treeState.order.length; i++) {
    const nodeId = treeState.order[i]
    if (processedNodes.has(nodeId)) continue

    const record = treeState.records[nodeId]
    if (!record) continue

    const segmentIndex = segments.length
    const node = record.data.node

    const effectiveConfig = getEffectiveContainerConfig(node)

    if (effectiveConfig && record.data.isOpen && node.children?.length) {
      const containerChildIds = effectiveConfig.childrenIds?.length
        ? new Set(effectiveConfig.childrenIds.filter(id => node.children!.includes(id)))
        : new Set(node.children)
      const containerChildren: (typeof record.data)[] = []
      const childRowIndices: number[] = []

      /* Collect only children specified in container config (must be consecutive from start) */
      for (let j = i + 1; j < treeState.order.length; j++) {
        const childId = treeState.order[j]

        /* Stop if we hit a node not in parent's children list */
        if (!node.children.includes(childId)) break

        /* Only process immediate children that are in containerChildIds */
        if (isImmediateChild(childId, nodeId, treeState)) {
          if (!containerChildIds.has(childId)) {
            /* Hit a child not in container - stop collecting */
            break
          }
          const childRecord = treeState.records[childId]
          if (childRecord) {
            const childNode = childRecord.data.node
            /* Stop if child has its own container */
            if (getEffectiveContainerConfig(childNode)) {
              break
            }
            containerChildren.push(childRecord.data)
            childRowIndices.push(j)
            processedNodes.add(childId)
            nodeToSegmentIndex.set(childId, segmentIndex)
          }
        }
      }

      if (containerChildren.length > 0) {
        const segment: SegmentContainer = {
          type: 'container',
          parentNode: node,
          parentTreeNode: record.data,
          config: effectiveConfig as SegmentContainer['config'],
          children: containerChildren,
          childRowIndices,
          depth: record.data.depth,
          parentRowIndex: i,
        }

        const paddingTop = segment.config.paddingTop ?? 8
        const paddingBottom = segment.config.paddingBottom ?? 8
        const parentHeight = options.rowHeight
        const childrenHeight = containerChildren.length * options.rowHeight
        const containerHeight = parentHeight + paddingTop + childrenHeight + paddingBottom

        segments.push(segment)
        segmentHeights.push(containerHeight)
        nodeToSegmentIndex.set(nodeId, segmentIndex)
        processedNodes.add(nodeId)
        continue
      }
    }

    const segment: SegmentNode = {
      type: 'node',
      data: record.data,
      rowIndex: i,
    }

    segments.push(segment)
    segmentHeights.push(options.rowHeight)
    nodeToSegmentIndex.set(nodeId, segmentIndex)
    processedNodes.add(nodeId)
  }

  return {
    segments,
    segmentHeights,
    nodeToSegmentIndex,
  }
}

export function getSegmentHeight(segmentState: SegmentState, index: number): number {
  return segmentState.segmentHeights[index] ?? 0
}

export function getSegmentCount(segmentState: SegmentState): number {
  return segmentState.segments.length
}

export function getSegmentByNodeId(
  segmentState: SegmentState,
  nodeId: string,
): { segment: Segment; index: number } | null {
  const index = segmentState.nodeToSegmentIndex.get(nodeId)
  if (index === undefined) return null

  const segment = segmentState.segments[index]
  if (!segment) return null

  return { segment, index }
}

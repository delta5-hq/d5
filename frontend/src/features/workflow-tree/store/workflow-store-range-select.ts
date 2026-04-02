import type { NodeId } from '@shared/base-types'

export interface RangeSelectResult {
  selectedId: NodeId
  selectedIds: Set<NodeId>
}

export function computeRangeSelection(
  anchorId: NodeId | undefined,
  targetId: NodeId,
  visibleOrder: readonly string[],
): RangeSelectResult | null {
  if (anchorId === undefined) return null

  const anchorIdx = visibleOrder.indexOf(anchorId)
  const targetIdx = visibleOrder.indexOf(targetId)

  if (anchorIdx === -1 || targetIdx === -1) return null

  const from = Math.min(anchorIdx, targetIdx)
  const to = Math.max(anchorIdx, targetIdx)

  const selectedIds = new Set<NodeId>()
  for (let i = from; i <= to; i++) {
    selectedIds.add(visibleOrder[i])
  }

  return { selectedId: targetId, selectedIds }
}

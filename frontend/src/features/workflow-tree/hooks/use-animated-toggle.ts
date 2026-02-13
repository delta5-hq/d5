import type { NodeData } from '@/shared/base-types/workflow'
import { getDescendantIds } from '@entities/workflow/lib'
import { useStableCallback } from '@shared/lib/hooks'
import { useTreeAnimation } from '../context'
import { computeCornerArrivalMs } from '../core/spark-delay'
import { ROW_HEIGHT, INDENT_PER_LEVEL, WIRE_PADDING, SPARK_DURATION_MS } from '../core/constants'

/* Edge delay for a direct child (rowsFromParent=1) — used to zero-base the first child's animation */
const FIRST_CHILD_EDGE_MS = computeCornerArrivalMs(1, ROW_HEIGHT, INDENT_PER_LEVEL, WIRE_PADDING, SPARK_DURATION_MS)

/**
 * Stable-identity toggle that schedules expand animations before toggling.
 * Deduplicates the ref+animation boilerplate shared by WorkflowTree and WorkflowSegmentTree.
 */
export function useAnimatedToggle(
  nodes: Record<string, NodeData>,
  expandedIds: Set<string>,
  toggleNode: (id: string) => void,
): (id: string, sparkDelay?: number) => void {
  const { scheduleAnimation } = useTreeAnimation()

  return useStableCallback((id: string, sparkDelay: number = 0) => {
    if (!expandedIds.has(id)) {
      const descendantIds = getDescendantIds(nodes, id)
      if (descendantIds.length > 0) {
        scheduleAnimation(descendantIds, sparkDelay + FIRST_CHILD_EDGE_MS)
      }
    }
    toggleNode(id)
  })
}

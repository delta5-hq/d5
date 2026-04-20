import type { Store } from '@shared/lib/store'
import type { NodeId } from '@shared/base-types'
import type { WorkflowStoreState } from './workflow-store-types'
import type { DebouncedPersister } from './workflow-store-persistence'

function applyExpansionChange(
  store: Store<WorkflowStoreState>,
  persister: DebouncedPersister,
  nodeId: NodeId,
  shouldExpand: boolean,
): void {
  const { expandedIds, nodes } = store.getState()
  const node = nodes[nodeId]
  if (!node) return

  const nextExpandedIds = new Set(expandedIds)
  if (shouldExpand) {
    nextExpandedIds.add(nodeId)
  } else {
    nextExpandedIds.delete(nodeId)
  }

  store.setState({
    expandedIds: nextExpandedIds,
    nodes: {
      ...nodes,
      [nodeId]: { ...node, collapsed: !shouldExpand },
    },
    isDirty: true,
  })

  persister.schedule()
}

export function bindExpansionActions(store: Store<WorkflowStoreState>, persister: DebouncedPersister) {
  const toggleExpanded = (nodeId: NodeId): void => {
    const { expandedIds } = store.getState()
    const isCurrentlyExpanded = expandedIds.has(nodeId)
    applyExpansionChange(store, persister, nodeId, !isCurrentlyExpanded)
  }

  const expandNode = (nodeId: NodeId): void => {
    const { expandedIds } = store.getState()
    if (!expandedIds.has(nodeId)) {
      applyExpansionChange(store, persister, nodeId, true)
    }
  }

  const collapseNode = (nodeId: NodeId): void => {
    const { expandedIds } = store.getState()
    if (expandedIds.has(nodeId)) {
      applyExpansionChange(store, persister, nodeId, false)
    }
  }

  return {
    toggleExpanded,
    expandNode,
    collapseNode,
  }
}

import type { Store } from '@shared/lib/store'
import type { NodeData, NodeId, WorkflowContentData } from '@shared/base-types'
import { mergeWorkflowNodes } from '@entities/workflow/lib'
import { executeWorkflowCommand } from '../api/execute-workflow-command'
import type { WorkflowStoreState } from './workflow-store-types'
import type { DebouncedPersister } from './workflow-store-persistence'

function addExecutingNode(store: Store<WorkflowStoreState>, nodeId: NodeId): void {
  store.setState(prev => ({
    executingNodeIds: new Set([...prev.executingNodeIds, nodeId]),
  }))
}

function removeExecutingNode(store: Store<WorkflowStoreState>, nodeId: NodeId): void {
  store.setState(prev => {
    const next = new Set(prev.executingNodeIds)
    next.delete(nodeId)
    return { executingNodeIds: next }
  })
}

export function bindExecuteAction(store: Store<WorkflowStoreState>, persister: DebouncedPersister) {
  return async (node: NodeData, queryType: string): Promise<boolean> => {
    if (store.getState().executingNodeIds.size > 0) return false

    const { isDirty, workflowId, nodes, edges, root, share } = store.getState()

    if (isDirty) {
      const saved = await persister.flush()
      if (!saved) return false
    }

    addExecutingNode(store, node.id)

    try {
      const workflowData: WorkflowContentData = {
        nodes,
        edges,
        root: root ?? '',
        share: share ?? { access: [] },
      }

      const response = await executeWorkflowCommand({
        queryType,
        cell: node,
        workflowNodes: nodes,
        workflowEdges: edges,
        workflowId,
      })

      const merged = mergeWorkflowNodes(workflowData, response)
      const { selectedId } = store.getState()
      const selectionStale = selectedId !== undefined && !(selectedId in merged.nodes)
      store.setState({
        nodes: merged.nodes,
        edges: merged.edges ?? {},
        root: merged.root,
        isDirty: true,
        ...(selectionStale ? { selectedId: undefined } : {}),
      })

      await persister.flush()
      return true
    } catch {
      return false
    } finally {
      removeExecutingNode(store, node.id)
    }
  }
}

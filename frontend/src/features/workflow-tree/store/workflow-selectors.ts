import { useSelector, shallowEqual } from '@shared/lib/store'
import type { NodeData, NodeId, EdgeData, EdgeId } from '@shared/base-types'
import type { WorkflowStoreState, WorkflowStoreActions } from './workflow-store-types'
import { useWorkflowStore } from './workflow-store-provider'

export function useWorkflowSelectedId(): NodeId | undefined {
  const { store } = useWorkflowStore()
  return useSelector(store, s => s.selectedId)
}

export function useWorkflowNode(nodeId: NodeId | undefined): NodeData | undefined {
  const { store } = useWorkflowStore()
  return useSelector(store, s => (nodeId ? s.nodes[nodeId] : undefined))
}

export function useWorkflowRoot(): NodeId | undefined {
  const { store } = useWorkflowStore()
  return useSelector(store, s => s.root)
}

export function useWorkflowNodes(): Record<NodeId, NodeData> {
  const { store } = useWorkflowStore()
  return useSelector(store, s => s.nodes)
}

export function useWorkflowEdges(): Record<EdgeId, EdgeData> {
  const { store } = useWorkflowStore()
  return useSelector(store, s => s.edges)
}

export function useWorkflowActions(): WorkflowStoreActions {
  const { actions } = useWorkflowStore()
  return actions
}

export function useWorkflowIsDirty(): boolean {
  const { store } = useWorkflowStore()
  return useSelector(store, s => s.isDirty)
}

export function useIsNodeExecuting(nodeId: NodeId | undefined): boolean {
  const { store } = useWorkflowStore()
  return useSelector(store, s => nodeId !== undefined && s.executingNodeIds.has(nodeId))
}

export function useWorkflowStatus(): Pick<WorkflowStoreState, 'isLoading' | 'error' | 'isSaving'> & {
  isExecuting: boolean
} {
  const { store } = useWorkflowStore()
  return useSelector(
    store,
    s => ({ isLoading: s.isLoading, error: s.error, isSaving: s.isSaving, isExecuting: s.executingNodeIds.size > 0 }),
    shallowEqual,
  )
}

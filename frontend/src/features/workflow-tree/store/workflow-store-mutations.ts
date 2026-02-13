import type { Store } from '@shared/lib/store'
import type { NodeData, NodeId } from '@shared/base-types'
import {
  createRootNode,
  addChildNode,
  updateNode as updateNodePure,
  removeNode as removeNodePure,
  moveNode as moveNodePure,
  duplicateNode as duplicateNodePure,
  NodeMutationError,
} from '@entities/workflow/lib'
import { toast } from 'sonner'
import type { WorkflowStoreState } from './workflow-store-types'
import type { DebouncedPersister } from './workflow-store-persistence'

export type FormatMessage = (descriptor: { id: string }) => string

const MUTATION_ERROR_KEYS: Record<string, string> = {
  INVALID_NODE_DATA: 'workflowTree.mutation.invalidNodeData',
  ROOT_EXISTS: 'workflowTree.mutation.rootExists',
  ROOT_WITH_PARENT: 'workflowTree.mutation.rootWithParent',
  PARENT_NOT_FOUND: 'workflowTree.mutation.parentNotFound',
  NODE_NOT_FOUND: 'workflowTree.mutation.nodeNotFound',
  CANNOT_REMOVE_ROOT: 'workflowTree.mutation.cannotRemoveRoot',
  CIRCULAR_REFERENCE: 'workflowTree.mutation.circularReference',
  CANNOT_MOVE_ROOT: 'workflowTree.mutation.cannotMoveRoot',
  TARGET_NOT_FOUND: 'workflowTree.mutation.targetNotFound',
  NO_TARGET_PARENT: 'workflowTree.mutation.noTargetParent',
  SELF_PARENT: 'workflowTree.mutation.selfParent',
}

export function bindMutationActions(
  store: Store<WorkflowStoreState>,
  persister: DebouncedPersister,
  formatMessage: FormatMessage,
) {
  function applyMutation<T>(mutationFn: () => T, onSuccess: (result: T) => void): T | null {
    try {
      const result = mutationFn()
      onSuccess(result)
      store.setState({ isDirty: true })
      persister.schedule()
      return result
    } catch (err) {
      const messageId =
        err instanceof NodeMutationError
          ? (MUTATION_ERROR_KEYS[err.code] ?? 'workflowTree.mutation.failed')
          : 'workflowTree.mutation.failed'
      toast.error(formatMessage({ id: messageId }))
      return null
    }
  }

  const createRoot = (nodeData: Partial<NodeData>): NodeId | null => {
    const { nodes } = store.getState()
    return (
      applyMutation(
        () => createRootNode(nodes, nodeData),
        result => store.setState({ nodes: result.nodes, root: result.newId }),
      )?.newId ?? null
    )
  }

  const addChild = (parentId: NodeId, nodeData: Partial<NodeData>): NodeId | null => {
    const { nodes } = store.getState()
    return (
      applyMutation(
        () => addChildNode(nodes, parentId, nodeData),
        result => store.setState({ nodes: result.nodes }),
      )?.newId ?? null
    )
  }

  const updateNode = (nodeId: NodeId, updates: Partial<Omit<NodeData, 'id' | 'parent'>>): boolean =>
    applyMutation(
      () => updateNodePure(store.getState().nodes, nodeId, updates),
      result => store.setState({ nodes: result }),
    ) !== null

  const removeNode = (nodeId: NodeId): boolean => {
    const { nodes, edges, selectedId } = store.getState()
    return (
      applyMutation(
        () => removeNodePure(nodes, edges, nodeId),
        result => {
          const clearSelection = selectedId !== undefined && result.removedNodeIds.includes(selectedId)
          store.setState({
            nodes: result.nodes,
            edges: result.edges,
            ...(clearSelection && { selectedId: undefined }),
          })
        },
      ) !== null
    )
  }

  const moveNode = (nodeId: NodeId, newParentId: NodeId): boolean =>
    applyMutation(
      () => moveNodePure(store.getState().nodes, nodeId, newParentId),
      result => store.setState({ nodes: result }),
    ) !== null

  const duplicateNode = (nodeId: NodeId, targetParentId?: NodeId): NodeId | null => {
    const { nodes, edges } = store.getState()
    return (
      applyMutation(
        () => duplicateNodePure(nodes, edges, nodeId, targetParentId),
        result => store.setState({ nodes: result.nodes, edges: result.edges }),
      )?.newRootId ?? null
    )
  }

  return { createRoot, addChild, updateNode, removeNode, moveNode, duplicateNode }
}

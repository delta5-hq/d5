import type { Store } from '@shared/lib/store'
import type { NodeData, NodeId } from '@shared/base-types'
import {
  createRootNode,
  addChildNode,
  addPromptChild as addPromptChildPure,
  removePromptChildren as removePromptChildrenPure,
  updateNode as updateNodePure,
  removeNode as removeNodePure,
  moveNode as moveNodePure,
  duplicateNode as duplicateNodePure,
  NodeMutationError,
  resolveSelectionAfterDelete,
  getTopLevelIds,
} from '@entities/workflow/lib'
import { toast } from 'sonner'
import type { WorkflowStoreState } from './workflow-store-types'
import type { DebouncedPersister } from './workflow-store-persistence'
import { excludeIds } from './workflow-store-set-utils'

export type FormatMessage = (descriptor: { id: string }, values?: Record<string, string | number>) => string

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

  const addSibling = (nodeId: NodeId, nodeData: Partial<NodeData>): NodeId | null => {
    const { nodes } = store.getState()
    const node = nodes[nodeId]
    if (!node?.parent) return null
    return addChild(node.parent, nodeData)
  }

  const updateNode = (nodeId: NodeId, updates: Partial<Omit<NodeData, 'id' | 'parent'>>): boolean =>
    applyMutation(
      () => updateNodePure(store.getState().nodes, nodeId, updates),
      result => store.setState({ nodes: result }),
    ) !== null

  const removeNode = (nodeId: NodeId): boolean => {
    const { nodes, edges, selectedId, selectedIds, anchorId } = store.getState()
    const nextSelectedId = selectedId !== undefined ? resolveSelectionAfterDelete(nodes, nodeId) : undefined
    return (
      applyMutation(
        () => removeNodePure(nodes, edges, nodeId),
        result => {
          const removedSet = new Set(result.removedNodeIds)
          const selectionAffected = selectedId !== undefined && removedSet.has(selectedId)
          const anchorAffected = anchorId !== undefined && removedSet.has(anchorId)

          const newSelectedIds = selectionAffected
            ? nextSelectedId
              ? new Set<NodeId>([nextSelectedId])
              : new Set<NodeId>()
            : excludeIds(selectedIds, removedSet)

          store.setState({
            nodes: result.nodes,
            edges: result.edges,
            ...(selectionAffected && { selectedId: nextSelectedId }),
            ...(newSelectedIds !== selectedIds && { selectedIds: newSelectedIds }),
            ...(anchorAffected && { anchorId: nextSelectedId }),
          })
        },
      ) !== null
    )
  }

  const removeNodes = (targetIds: Set<NodeId>): number => {
    if (targetIds.size === 0) return 0

    const { nodes, edges, executingNodeIds, selectedIds, anchorId } = store.getState()

    const candidateIds = [...targetIds].filter(id => nodes[id]?.parent && !executingNodeIds.has(id))
    const deletableIds = getTopLevelIds(nodes, new Set(candidateIds))

    if (deletableIds.length === 0) return 0

    let currentNodes = nodes
    let currentEdges = edges
    let totalRemoved = 0
    const removedSet = new Set<NodeId>()

    for (const id of deletableIds) {
      if (!(id in currentNodes)) continue
      try {
        const result = removeNodePure(currentNodes, currentEdges, id)
        for (const rid of result.removedNodeIds) removedSet.add(rid)
        currentNodes = result.nodes
        currentEdges = result.edges
        totalRemoved++
      } catch {
        /* node already gone via cascade — skip */
      }
    }

    if (totalRemoved === 0) return 0

    const survivorIds = excludeIds(selectedIds, removedSet)
    const lastSurvivor = survivorIds.size > 0 ? [...survivorIds].at(-1) : undefined
    const anchorAffected = anchorId !== undefined && removedSet.has(anchorId)

    store.setState({
      nodes: currentNodes,
      edges: currentEdges,
      selectedId: lastSurvivor,
      selectedIds: survivorIds,
      ...(anchorAffected && { anchorId: undefined }),
      isDirty: true,
    })
    persister.schedule()

    let removed = 0
    let skipped = 0
    for (const id of targetIds) {
      if (removedSet.has(id)) removed++
      else if (id in currentNodes) skipped++
    }
    if (skipped > 0) {
      toast.warning(formatMessage({ id: 'workflowTree.mutation.bulkDeletePartial' }, { removed, skipped }))
    }

    return totalRemoved
  }

  const moveNode = (nodeId: NodeId, newParentId: NodeId): boolean =>
    applyMutation(
      () => moveNodePure(store.getState().nodes, nodeId, newParentId),
      result => store.setState({ nodes: result }),
    ) !== null

  const addPromptChild = (parentId: NodeId, nodeData: Partial<NodeData>): NodeId | null => {
    const { nodes } = store.getState()
    return (
      applyMutation(
        () => addPromptChildPure(nodes, parentId, nodeData),
        result => store.setState({ nodes: result.nodes }),
      )?.newId ?? null
    )
  }

  const removePromptChildren = (parentId: NodeId): boolean =>
    applyMutation(
      () => removePromptChildrenPure(store.getState().nodes, parentId),
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

  return {
    createRoot,
    addChild,
    addSibling,
    addPromptChild,
    removePromptChildren,
    updateNode,
    removeNode,
    removeNodes,
    moveNode,
    duplicateNode,
  }
}

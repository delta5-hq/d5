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
  wrapNodesInParent,
  NodeMutationError,
  resolveSelectionAfterDelete,
  getTopLevelIds,
  isStepsNode,
  applySequentialPrefixes,
  reorderAndRenumberStepsChildren,
} from '@entities/workflow/lib'
import { toast } from 'sonner'
import type { WorkflowStoreState } from './workflow-store-types'
import type { DebouncedPersister } from './workflow-store-persistence'
import type { HistoryStack } from './workflow-store-history'
import { excludeIds } from './workflow-store-set-utils'
import { createPromptNodesFromText } from './text-to-prompts-splitter'
import {
  collectAttachmentReferences,
  deleteAttachmentFiles,
  type AttachmentLifecycleDeps,
} from './workflow-attachment-lifecycle'
import { reconcileRemoveFlush } from './workflow-remove-flush-reconciler'
import type { ReadWorkflowFn } from './workflow-store-types'

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
  historyStack: HistoryStack,
  attachmentLifecycle?: {
    workflowId: string
    deleteWorkflowFile: AttachmentLifecycleDeps['deleteFile']
    readWorkflow: ReadWorkflowFn
  },
) {
  const attachmentOnError = (code: string): void => {
    toast.error(formatMessage({ id: code }))
  }
  const attachmentDeps = attachmentLifecycle
    ? {
        workflowId: attachmentLifecycle.workflowId,
        deleteFile: attachmentLifecycle.deleteWorkflowFile,
        onError: attachmentOnError,
      }
    : undefined

  function applyMutation<T>(mutationFn: () => T, onSuccess: (result: T) => void): T | null {
    try {
      const result = mutationFn()
      const { nodes, edges, root } = store.getState()
      historyStack.checkpoint({ nodes, edges, root })
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
        result => store.setState({ nodes: applySequentialPrefixes(result.nodes, parentId) }),
      )?.newId ?? null
    )
  }

  const addSibling = (nodeId: NodeId, nodeData: Partial<NodeData>): NodeId | null => {
    const { nodes } = store.getState()
    const node = nodes[nodeId]
    if (!node?.parent) return null
    return addChild(node.parent, nodeData)
  }

  const updateNode = (nodeId: NodeId, updates: Partial<Omit<NodeData, 'id' | 'parent'>>): boolean => {
    const currentNodes = store.getState().nodes
    const parentId = currentNodes[nodeId]?.parent
    return (
      applyMutation(
        () => updateNodePure(currentNodes, nodeId, updates),
        result => {
          const { dirtyNodeIds } = store.getState()
          const finalNodes = 'title' in updates && parentId ? reorderAndRenumberStepsChildren(result, parentId) : result
          store.setState({ nodes: finalNodes, dirtyNodeIds: new Set([...dirtyNodeIds, nodeId]) })
        },
      ) !== null
    )
  }

  const removeNode = (nodeId: NodeId): boolean => {
    const { nodes, edges, selectedId, selectedIds, anchorId } = store.getState()
    try {
      const removedNodeParent = nodes[nodeId]?.parent
      const stepsParentId =
        removedNodeParent && isStepsNode(nodes[removedNodeParent] ?? ({} as NodeData)) ? removedNodeParent : undefined
      const nextSelectedId = selectedId !== undefined ? resolveSelectionAfterDelete(nodes, nodeId) : undefined
      const result = removeNodePure(nodes, edges, nodeId)
      const removedSet = new Set(result.removedNodeIds)
      const attachmentReferences = attachmentDeps ? collectAttachmentReferences(nodes, removedSet) : []

      const applyRemoval = (): void => {
        const selectionAffected = selectedId !== undefined && removedSet.has(selectedId)
        const anchorAffected = anchorId !== undefined && removedSet.has(anchorId)

        const newSelectedIds = selectionAffected
          ? nextSelectedId
            ? new Set<NodeId>([nextSelectedId])
            : new Set<NodeId>()
          : excludeIds(selectedIds, removedSet)

        const { dirtyNodeIds } = store.getState()
        const cleanedDirtyIds = excludeIds(dirtyNodeIds, removedSet)
        const finalNodes = stepsParentId ? applySequentialPrefixes(result.nodes, stepsParentId) : result.nodes
        store.setState({
          nodes: finalNodes,
          edges: result.edges,
          ...(selectionAffected && { selectedId: nextSelectedId }),
          ...(newSelectedIds !== selectedIds && { selectedIds: newSelectedIds }),
          ...(anchorAffected && { anchorId: nextSelectedId }),
          ...(cleanedDirtyIds !== dirtyNodeIds && { dirtyNodeIds: cleanedDirtyIds }),
          isDirty: true,
        })
        persister.schedule()
      }

      if (attachmentReferences.length === 0 || !attachmentDeps) {
        historyStack.checkpoint({ nodes, edges, root: store.getState().root })
        applyRemoval()
        return true
      }
      void (async () => {
        if (!(await deleteAttachmentFiles(attachmentDeps, attachmentReferences))) return
        applyRemoval()
        historyStack.clear()
        await reconcileRemoveFlush({
          persister,
          workflowId: attachmentDeps.workflowId,
          readWorkflow: attachmentLifecycle!.readWorkflow,
          removedFileIds: attachmentReferences.map(r => r.fileId),
          onDanglingLinkSurvived: () => attachmentOnError('workflowTree.attachment.removeFlushFailed'),
        })
      })()
      return true
    } catch (err) {
      const messageId =
        err instanceof NodeMutationError
          ? (MUTATION_ERROR_KEYS[err.code] ?? 'workflowTree.mutation.failed')
          : 'workflowTree.mutation.failed'
      toast.error(formatMessage({ id: messageId }))
      return false
    }
  }

  const removeNodes = (targetIds: Set<NodeId>): number => {
    if (targetIds.size === 0) return 0

    const { nodes, edges, executingNodeIds, selectedIds, anchorId } = store.getState()

    const candidateIds = [...targetIds].filter(id => nodes[id]?.parent && !executingNodeIds.has(id))
    const deletableIds = getTopLevelIds(nodes, new Set(candidateIds))

    if (deletableIds.length === 0) return 0

    const stepsParentIds = new Set<NodeId>()
    for (const id of deletableIds) {
      const parentId = nodes[id]?.parent
      const parentNode = parentId ? nodes[parentId] : undefined
      if (parentId && parentNode && isStepsNode(parentNode)) stepsParentIds.add(parentId)
    }

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

    const attachmentReferences = attachmentDeps ? collectAttachmentReferences(nodes, removedSet) : []

    let finalNodes = currentNodes
    for (const parentId of stepsParentIds) {
      if (finalNodes[parentId]) finalNodes = applySequentialPrefixes(finalNodes, parentId)
    }

    const survivorIds = excludeIds(selectedIds, removedSet)
    const lastSurvivor = survivorIds.size > 0 ? [...survivorIds].at(-1) : undefined
    const anchorAffected = anchorId !== undefined && removedSet.has(anchorId)
    const { dirtyNodeIds } = store.getState()
    const cleanedDirtyIds = excludeIds(dirtyNodeIds, removedSet)

    const applyBulkRemoval = (): void => {
      store.setState({
        nodes: finalNodes,
        edges: currentEdges,
        selectedId: lastSurvivor,
        selectedIds: survivorIds,
        ...(anchorAffected && { anchorId: undefined }),
        ...(cleanedDirtyIds !== dirtyNodeIds && { dirtyNodeIds: cleanedDirtyIds }),
        isDirty: true,
      })
      persister.schedule()
    }

    if (attachmentReferences.length === 0 || !attachmentDeps) {
      historyStack.checkpoint({ nodes, edges, root: store.getState().root })
      applyBulkRemoval()
    } else {
      void (async () => {
        if (!(await deleteAttachmentFiles(attachmentDeps, attachmentReferences))) return
        applyBulkRemoval()
        historyStack.clear()
        await reconcileRemoveFlush({
          persister,
          workflowId: attachmentDeps.workflowId,
          readWorkflow: attachmentLifecycle!.readWorkflow,
          removedFileIds: attachmentReferences.map(r => r.fileId),
          onDanglingLinkSurvived: () => attachmentOnError('workflowTree.attachment.removeFlushFailed'),
        })
      })()
    }

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

  const moveNode = (nodeId: NodeId, newParentId: NodeId, insertionIndex?: number): boolean => {
    const { nodes } = store.getState()
    const oldParentId = nodes[nodeId]?.parent
    return (
      applyMutation(
        () => moveNodePure(nodes, nodeId, newParentId, insertionIndex),
        result => {
          let finalNodes = result
          if (oldParentId && oldParentId !== newParentId) {
            finalNodes = applySequentialPrefixes(finalNodes, oldParentId)
          }
          finalNodes = applySequentialPrefixes(finalNodes, newParentId)
          store.setState({ nodes: finalNodes })
        },
      ) !== null
    )
  }

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

  const importTextAsPrompts = (parentId: NodeId, text: string): number => {
    if (!text.trim()) return 0

    const promptNodes = createPromptNodesFromText(parentId, text)

    if (!removePromptChildren(parentId)) return 0

    let imported = 0
    for (const promptData of promptNodes) {
      const newId = addPromptChild(parentId, promptData)
      if (newId) imported++
    }

    return imported
  }

  const wrapNodes = (nodeIds: Set<NodeId>): NodeId | null => {
    const { nodes, edges } = store.getState()
    const ordered = [...nodeIds]
    return (
      applyMutation(
        () => wrapNodesInParent(nodes, edges, ordered),
        result => {
          store.setState({ nodes: result.nodes, edges: result.edges })
          store.setState({ selectedId: result.newParentId, selectedIds: new Set([result.newParentId]) })
        },
      )?.newParentId ?? null
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
    importTextAsPrompts,
    wrapNodes,
  }
}

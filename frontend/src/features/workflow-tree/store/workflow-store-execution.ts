import type { Store } from '@shared/lib/store'
import type { NodeData, NodeId, WorkflowContentData, NodeDatas } from '@shared/base-types'
import { mergeWorkflowChanges } from '@entities/workflow/lib'
import { executeWorkflowCommand } from '../api/execute-workflow-command'
import type { WorkflowStoreState } from './workflow-store-types'
import type { DebouncedPersister } from './workflow-store-persistence'
import { retainExistingIds } from './workflow-store-set-utils'
import { notifyExecutionStarted, notifyExecutionCompleted, notifyExecutionAborted } from './execution-genie-bridge'
import { generateNodeId } from '@shared/lib/generate-id'

function addExecutingNode(store: Store<WorkflowStoreState>, nodeId: NodeId): void {
  store.setState(prev => ({
    executingNodeIds: new Set([...prev.executingNodeIds, nodeId]),
  }))
}

function newDirectChildren(
  nodesChanged: Record<string, NodeData>,
  parentId: NodeId,
  existingNodes: NodeDatas,
): NodeData[] {
  return Object.values(nodesChanged).filter(n => n.parent === parentId && !(n.id in existingNodes))
}

function firstAnchoredNewNodeId(
  nodesChanged: Record<string, NodeData>,
  executedNodeId: NodeId,
  existingNodes: NodeDatas,
): NodeId | undefined {
  const childrenOfExecuted = new Set(existingNodes[executedNodeId]?.children ?? [])
  const newNode = Object.values(nodesChanged).find(
    n => !(n.id in existingNodes) && n.parent !== undefined && childrenOfExecuted.has(n.parent),
  )
  return newNode?.id
}

function removeExecutingNode(store: Store<WorkflowStoreState>, nodeId: NodeId): void {
  store.setState(prev => {
    const next = new Set(prev.executingNodeIds)
    next.delete(nodeId)
    return { executingNodeIds: next }
  })
}

export interface ExecutionActions {
  executeCommand: (node: NodeData, queryType: string) => Promise<boolean>
  abortExecution: (nodeId: NodeId) => void
}

export function bindExecuteAction(store: Store<WorkflowStoreState>, persister: DebouncedPersister): ExecutionActions {
  const abortControllers = new Map<NodeId, AbortController>()

  const abortExecution = (nodeId: NodeId): void => {
    abortControllers.get(nodeId)?.abort()
  }

  const executeCommand = async (node: NodeData, queryType: string): Promise<boolean> => {
    if (store.getState().executingNodeIds.has(node.id)) return false

    if (store.getState().isDirty) {
      const saved = await persister.flush()
      if (!saved) return false
    }

    const controller = new AbortController()
    abortControllers.set(node.id, controller)
    addExecutingNode(store, node.id)
    notifyExecutionStarted(node.id)

    let responseReceived = false
    try {
      const { workflowId, nodes, edges } = store.getState()

      const response = await executeWorkflowCommand({
        queryType,
        cell: node,
        workflowNodes: nodes,
        workflowEdges: edges,
        workflowId,
        signal: controller.signal,
      })
      responseReceived = true

      if (Object.keys(response.nodesChanged ?? {}).length === 0) {
        const emptyNodeId = generateNodeId()
        store.setState(prev => {
          const parent = prev.nodes[node.id]
          if (!parent) return prev
          const emptyNode: NodeData = { id: emptyNodeId, title: '(no output)', parent: node.id }
          const updatedParent: NodeData = { ...parent, children: [...(parent.children ?? []), emptyNodeId] }
          return {
            nodes: { ...prev.nodes, [node.id]: updatedParent, [emptyNodeId]: emptyNode },
            expandedIds: new Set([...prev.expandedIds, node.id]),
            selectedId: emptyNodeId,
            isDirty: true,
          }
        })
        await persister.flush()
        notifyExecutionCompleted(node.id, true)
        return true
      }

      const current = store.getState()
      const currentData: WorkflowContentData = {
        nodes: current.nodes,
        edges: current.edges,
        root: current.root ?? '',
        share: current.share ?? { access: [] },
      }
      const merged = mergeWorkflowChanges(currentData, response)
      const nodesChanged = response.nodesChanged ?? {}

      const newChildren = newDirectChildren(nodesChanged, node.id, nodes)
      const autoSelected: NodeId | undefined = newChildren[0]?.id
      const fallbackSelected: NodeId | undefined =
        newChildren.length === 0 ? firstAnchoredNewNodeId(nodesChanged, node.id, nodes) : undefined
      const resolvedSelected = autoSelected ?? fallbackSelected

      const newChildrenCreated = newChildren.length > 0
      const selectionStale =
        !resolvedSelected && current.selectedId !== undefined && !(current.selectedId in merged.nodes)
      const anchorStale = current.anchorId !== undefined && !(current.anchorId in merged.nodes)
      const cleanedIds = autoSelected ? new Set<string>() : retainExistingIds(current.selectedIds, merged.nodes)

      const shouldRevealChildren = autoSelected !== undefined || newChildrenCreated
      const mergedNodes =
        shouldRevealChildren && merged.nodes[node.id]
          ? { ...merged.nodes, [node.id]: { ...merged.nodes[node.id], collapsed: false } }
          : merged.nodes
      const nextExpandedIds = shouldRevealChildren ? new Set([...current.expandedIds, node.id]) : current.expandedIds

      store.setState({
        nodes: mergedNodes,
        edges: merged.edges ?? {},
        root: merged.root,
        isDirty: true,
        expandedIds: nextExpandedIds,
        ...(resolvedSelected !== undefined
          ? { selectedId: resolvedSelected }
          : selectionStale
            ? { selectedId: undefined }
            : {}),
        ...(anchorStale ? { anchorId: undefined } : {}),
        ...(cleanedIds !== current.selectedIds ? { selectedIds: cleanedIds } : {}),
      })
      await persister.flush()
      notifyExecutionCompleted(node.id, true)
      return true
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        notifyExecutionAborted(node.id)
      } else {
        if (!responseReceived) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          const errorNodeId = generateNodeId()
          store.setState(prev => {
            const parent = prev.nodes[node.id]
            if (!parent) return prev
            const errorNode: NodeData = { id: errorNodeId, title: `Error: ${message}`, parent: node.id }
            const updatedParent: NodeData = { ...parent, children: [...(parent.children ?? []), errorNodeId] }
            return {
              nodes: { ...prev.nodes, [node.id]: updatedParent, [errorNodeId]: errorNode },
              expandedIds: new Set([...prev.expandedIds, node.id]),
              selectedId: errorNodeId,
              isDirty: true,
            }
          })
        }
        notifyExecutionCompleted(node.id, false)
      }
      return false
    } finally {
      abortControllers.delete(node.id)
      removeExecutingNode(store, node.id)
    }
  }

  return { executeCommand, abortExecution }
}

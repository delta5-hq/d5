import type { Store } from '@shared/lib/store'
import type { NodeData, NodeId, WorkflowContentData, NodeDatas } from '@shared/base-types'
import { mergeWorkflowChanges } from '@entities/workflow/lib'
import { executeWorkflowCommand } from '../api/execute-workflow-command'
import type { WorkflowStoreState } from './workflow-store-types'
import type { DebouncedPersister } from './workflow-store-persistence'
import { retainExistingIds } from './workflow-store-set-utils'
import { notifyExecutionStarted, notifyExecutionCompleted, notifyExecutionAborted } from './execution-genie-bridge'
import { generateNodeId } from '@shared/lib/generate-id'
import { clearTreeAnimation, scheduleTreeAnimation } from '../core/tree-animation-store'
import { findNodeSparkDelay } from '../core/tree-walker'
import { SPARK_DURATION_MS } from '../core/constants'

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

function populatedExistingFanOutTargets(
  nodesChanged: Record<string, NodeData>,
  existingNodes: NodeDatas,
  mergedNodes: NodeDatas,
  executedNodeId: NodeId,
): NodeData[] {
  const fanOutRootId = existingNodes[executedNodeId]?.parent ?? executedNodeId
  const resultParentIds = new Set(
    Object.values(nodesChanged)
      .filter(changed => !(changed.id in existingNodes) && changed.parent !== undefined)
      .map(changed => changed.parent as NodeId),
  )

  return [...resultParentIds]
    .map(id => nodesChanged[id] ?? mergedNodes[id])
    .filter(
      (candidate): candidate is NodeData =>
        candidate !== undefined &&
        candidate.id !== executedNodeId &&
        candidate.id in existingNodes &&
        Boolean(candidate.command?.trim()) &&
        ancestorPathTo(mergedNodes, candidate.id, fanOutRootId) !== null,
    )
}

function ancestorPathTo(nodes: NodeDatas, nodeId: NodeId, ancestorId: NodeId): NodeId[] | null {
  const path: NodeId[] = []
  const visited = new Set<NodeId>([nodeId])
  let cursor = nodes[nodeId]?.parent

  while (cursor !== undefined && !visited.has(cursor)) {
    path.push(cursor)
    if (cursor === ancestorId) return path
    visited.add(cursor)
    cursor = nodes[cursor]?.parent
  }

  return null
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
          const selectedIds = new Set<NodeId>()
          return {
            nodes: { ...prev.nodes, [node.id]: updatedParent, [emptyNodeId]: emptyNode },
            expandedIds: new Set([...prev.expandedIds, node.id]),
            selectedId: emptyNodeId,
            selectedIds,
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

      const fanOutTargets =
        queryType === 'foreach' ? populatedExistingFanOutTargets(nodesChanged, nodes, mergedNodes, node.id) : []
      const resultRevealParentIds = fanOutTargets.map(target => target.id)
      const fanOutRootId = nodes[node.id]?.parent ?? node.id
      const fanOutAncestorIds = new Set(
        fanOutTargets.flatMap(target => ancestorPathTo(mergedNodes, target.id, fanOutRootId) ?? []),
      )
      const visibleNodes =
        resultRevealParentIds.length > 0
          ? (() => {
              const nextNodes = { ...mergedNodes }
              fanOutAncestorIds.forEach(id => {
                if (nextNodes[id]) nextNodes[id] = { ...nextNodes[id], collapsed: false }
              })
              resultRevealParentIds.forEach(id => {
                if (nextNodes[id]) nextNodes[id] = { ...nextNodes[id], collapsed: true }
              })
              return nextNodes
            })()
          : mergedNodes
      const visibleExpandedIds =
        resultRevealParentIds.length > 0
          ? new Set([...nextExpandedIds, ...fanOutAncestorIds].filter(id => !resultRevealParentIds.includes(id)))
          : nextExpandedIds

      let resultRevealDelayMs = 0
      if (fanOutTargets.length > 0) {
        const initiatorSparkDelay = findNodeSparkDelay(
          { nodes: visibleNodes, rootId: merged.root, expandedIds: visibleExpandedIds },
          node.id,
        )
        const relativeTargetDelays = fanOutTargets.map(target =>
          Math.max(
            0,
            findNodeSparkDelay(
              { nodes: visibleNodes, rootId: merged.root, expandedIds: visibleExpandedIds },
              target.id,
            ) - initiatorSparkDelay,
          ),
        )
        resultRevealDelayMs = Math.max(...relativeTargetDelays) + SPARK_DURATION_MS
        const relativeDelayByNodeId = Object.fromEntries(
          fanOutTargets.map((target, index) => [target.id, relativeTargetDelays[index]]),
        )
        scheduleTreeAnimation(resultRevealParentIds, initiatorSparkDelay, relativeDelayByNodeId)
      }

      store.setState({
        nodes: visibleNodes,
        edges: merged.edges ?? {},
        root: merged.root,
        isDirty: true,
        expandedIds: visibleExpandedIds,
        ...(resolvedSelected !== undefined
          ? { selectedId: resolvedSelected }
          : selectionStale
            ? { selectedId: undefined }
            : {}),
        ...(anchorStale ? { anchorId: undefined } : {}),
        ...(cleanedIds !== current.selectedIds ? { selectedIds: cleanedIds } : {}),
      })

      if (resultRevealParentIds.length > 0) {
        window.setTimeout(() => {
          resultRevealParentIds.forEach(id => clearTreeAnimation(id))
          store.setState(prev => {
            const nextNodes = { ...prev.nodes }
            const nextExpandedIds = new Set(prev.expandedIds)
            for (const id of resultRevealParentIds) {
              const existing = nextNodes[id]
              if (existing) {
                nextNodes[id] = { ...existing, collapsed: false }
                nextExpandedIds.add(id)
              }
            }
            return {
              nodes: nextNodes,
              expandedIds: nextExpandedIds,
              isDirty: true,
            }
          })
          persister.schedule()
        }, resultRevealDelayMs)
      }

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
            const selectedIds = new Set<NodeId>()
            return {
              nodes: { ...prev.nodes, [node.id]: updatedParent, [errorNodeId]: errorNode },
              expandedIds: new Set([...prev.expandedIds, node.id]),
              selectedId: errorNodeId,
              selectedIds,
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

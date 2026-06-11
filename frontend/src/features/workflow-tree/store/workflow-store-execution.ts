import type { Store } from '@shared/lib/store'
import type { NodeData, NodeId, WorkflowContentData } from '@shared/base-types'
import { mergeWorkflowChanges } from '@entities/workflow/lib'
import { holdMinDuration } from '@shared/lib/async'
import { executeWorkflowCommand } from '../api/execute-workflow-command'
import type { WorkflowStoreState } from './workflow-store-types'
import type { DebouncedPersister } from './workflow-store-persistence'
import { retainExistingIds } from './workflow-store-set-utils'
import { notifyExecutionStarted, notifyExecutionCompleted, notifyExecutionAborted } from './execution-genie-bridge'
import { ForkStreamClient } from '../api/streaming/fork-stream-client'
import type { ForkEvent } from '../api/streaming/fork-event-types'
import { applyForkEventToMap } from './fork-preview-state'
import { isValidRefineCell } from '@shared/lib/reliability/refine-params'

// Keeps the executing indicator visible long enough to be perceivable under sub-frame substrates (NoopLLM, cache hits).
const MIN_EXECUTING_VISIBLE_MS = 400

function hasRefineDescendant(nodeId: NodeId, nodes: Record<NodeId, NodeData>): boolean {
  const node = nodes[nodeId]
  if (!node) return false
  for (const childId of node.children ?? []) {
    const child = nodes[childId]
    if (!child) continue
    if (isValidRefineCell(child.command)) return true
    if (hasRefineDescendant(childId, nodes)) return true
  }
  return false
}

function applyForkEvent(store: Store<WorkflowStoreState>, event: ForkEvent): void {
  store.setState(prev => ({
    ...prev,
    forkPreviews: applyForkEventToMap(prev.forkPreviews, event),
  }))
}

function clearForkPreviews(store: Store<WorkflowStoreState>, ids: Set<NodeId>): void {
  if (ids.size === 0) return
  store.setState(prev => {
    const next = new Map(prev.forkPreviews)
    for (const id of ids) {
      next.delete(id)
    }
    return { ...prev, forkPreviews: next }
  })
}

export interface ExecuteActionOptions {
  minExecutingVisibleMs?: number
}

export interface ExecutionActions {
  executeCommand: (node: NodeData, queryType: string) => Promise<boolean>
  abortExecution: (nodeId: NodeId) => void
}

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

export function bindExecuteAction(
  store: Store<WorkflowStoreState>,
  persister: DebouncedPersister,
  options: ExecuteActionOptions = {},
): ExecutionActions {
  const minVisibleMs = options.minExecutingVisibleMs ?? MIN_EXECUTING_VISIBLE_MS
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
    const indicatorStartMs = Date.now()
    addExecutingNode(store, node.id)
    notifyExecutionStarted(node.id)

    let wasAborted = false

    try {
      const { workflowId, nodes, edges } = store.getState()

      const useStreaming = isValidRefineCell(node.command) || hasRefineDescendant(node.id, nodes)
      const sessionId = useStreaming ? crypto.randomUUID() : undefined
      let streamClient: ForkStreamClient | null = null
      const seenRefineIds = new Set<NodeId>()

      if (useStreaming && sessionId) {
        streamClient = new ForkStreamClient(sessionId, {
          onForkEvent: event => {
            seenRefineIds.add(event.refineNodeId)
            applyForkEvent(store, event)
          },
        })
        streamClient.connect()
      }

      let response
      try {
        response = await executeWorkflowCommand({
          queryType,
          cell: node,
          workflowNodes: nodes,
          workflowEdges: edges,
          workflowId,
          signal: controller.signal,
          ...(sessionId ? { streamSessionId: sessionId } : {}),
        })
      } finally {
        streamClient?.disconnect()
        clearForkPreviews(store, seenRefineIds)
      }

      const current = store.getState()
      const currentData: WorkflowContentData = {
        nodes: current.nodes,
        edges: current.edges,
        root: current.root ?? '',
        share: current.share ?? { access: [] },
      }
      const merged = mergeWorkflowChanges(currentData, response)
      const selectionStale = current.selectedId !== undefined && !(current.selectedId in merged.nodes)
      const anchorStale = current.anchorId !== undefined && !(current.anchorId in merged.nodes)
      const cleanedIds = retainExistingIds(current.selectedIds, merged.nodes)
      store.setState({
        nodes: merged.nodes,
        edges: merged.edges ?? {},
        root: merged.root,
        isDirty: true,
        ...(selectionStale ? { selectedId: undefined } : {}),
        ...(anchorStale ? { anchorId: undefined } : {}),
        ...(cleanedIds !== current.selectedIds ? { selectedIds: cleanedIds } : {}),
      })

      await persister.flush()
      notifyExecutionCompleted(node.id, true)
      return true
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        wasAborted = true
        notifyExecutionAborted(node.id)
      } else {
        notifyExecutionCompleted(node.id, false)
      }
      return false
    } finally {
      abortControllers.delete(node.id)
      if (!wasAborted) {
        await holdMinDuration(indicatorStartMs, minVisibleMs)
      }
      removeExecutingNode(store, node.id)
    }
  }

  return { executeCommand, abortExecution }
}

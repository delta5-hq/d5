import { createStore, type Store } from '@shared/lib/store'
import { apiFetch } from '@shared/lib/base-api'
import type { WorkflowStoreState, WorkflowStoreActions } from './workflow-store-types'
import { INITIAL_WORKFLOW_STATE } from './workflow-store-types'
import { createDebouncedPersister } from './workflow-store-persistence'
import { bindMutationActions, type FormatMessage } from './workflow-store-mutations'
import { bindExecuteAction } from './workflow-store-execution'
import { bindExpansionActions } from './workflow-store-expansion'
import { createHistoryStack } from './workflow-store-history'
import { retainExistingIds } from './workflow-store-set-utils'
import { computeRangeSelection } from './workflow-store-range-select'
import { deriveExpandedIdsFromNodes } from '../hooks/use-tree-expansion'
import { isCommandlessTextNode, hasOnlyPromptChildren } from '@entities/workflow/lib'

interface WorkflowApiResponse {
  _id: string
  workflowId: string
  userId: string
  createdAt: string
  updatedAt: string
  nodes: Record<string, unknown>
  edges?: Record<string, unknown>
  root?: string
  share?: { access: unknown[] }
}

export interface WorkflowStore {
  store: Store<WorkflowStoreState>
  actions: WorkflowStoreActions
}

export function createWorkflowStore(workflowId: string, formatMessage: FormatMessage): WorkflowStore {
  const store = createStore<WorkflowStoreState>({
    ...INITIAL_WORKFLOW_STATE,
    workflowId,
    isLoading: true,
  })

  const persister = createDebouncedPersister(store, payload => {
    const rootTitle = payload.root ? (payload.nodes[payload.root]?.title ?? '') : undefined
    return apiFetch(`/workflow/${workflowId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...payload, ...(rootTitle !== undefined && { title: rootTitle }) }),
      headers: { 'Content-Type': 'application/json' },
    })
  })

  const historyStack = createHistoryStack()
  let loadVersion = 0
  const mutations = bindMutationActions(store, persister, formatMessage, historyStack)
  const execution = bindExecuteAction(store, persister)
  const expansion = bindExpansionActions(store, persister)

  const toggleExpanded = (nodeId: string): void => {
    const { nodes, expandedIds } = store.getState()
    const node = nodes[nodeId]
    const expanding = node && !expandedIds.has(nodeId)
    if (expanding && isCommandlessTextNode(node) && hasOnlyPromptChildren(nodeId, nodes)) {
      mutations.importTextAsPrompts(nodeId, node.title ?? '')
    }
    expansion.toggleExpanded(nodeId)
  }

  const load = async () => {
    const requestVersion = ++loadVersion
    store.setState({ isLoading: true, error: null })
    try {
      const data = await apiFetch<WorkflowApiResponse>(`/workflow/${workflowId}`)
      if (requestVersion !== loadVersion) return
      const newNodes = (data.nodes ?? {}) as WorkflowStoreState['nodes']
      const { selectedId, selectedIds, anchorId } = store.getState()
      const selectionStale = selectedId !== undefined && !(selectedId in newNodes)
      const anchorStale = anchorId !== undefined && !(anchorId in newNodes)
      const cleanedIds = retainExistingIds(selectedIds, newNodes)
      const expandedIds = data.root ? deriveExpandedIdsFromNodes(newNodes, data.root) : new Set<string>()
      store.setState({
        nodes: newNodes,
        edges: (data.edges ?? {}) as WorkflowStoreState['edges'],
        root: data.root,
        share: data.share as WorkflowStoreState['share'],
        expandedIds,
        isLoading: false,
        isDirty: false,
        dirtyNodeIds: new Set<string>(),
        ...(selectionStale ? { selectedId: undefined } : {}),
        ...(cleanedIds !== selectedIds ? { selectedIds: cleanedIds } : {}),
        ...(anchorStale ? { anchorId: undefined } : {}),
      })
    } catch (err) {
      if (requestVersion !== loadVersion) return
      store.setState({
        isLoading: false,
        error: err instanceof Error ? err : new Error('Failed to load workflow'),
      })
    }
  }

  const select = (nodeId: string | undefined) => {
    store.setState({
      selectedId: nodeId,
      selectedIds: nodeId ? new Set([nodeId]) : new Set<string>(),
      anchorId: nodeId,
    })
  }

  const toggleSelect = (nodeId: string) => {
    const { selectedIds } = store.getState()
    const next = new Set(selectedIds)
    if (next.has(nodeId)) {
      next.delete(nodeId)
    } else {
      next.add(nodeId)
    }
    const lastId = [...next].at(-1)
    store.setState({ selectedId: lastId, selectedIds: next })
  }

  const rangeSelect = (targetId: string, visibleOrder: readonly string[]) => {
    const { anchorId } = store.getState()
    const result = computeRangeSelection(anchorId, targetId, visibleOrder)
    if (result) {
      store.setState({ selectedId: result.selectedId, selectedIds: result.selectedIds })
    } else {
      select(targetId)
    }
  }

  const discard = () => {
    persister.cancel()
    load()
  }

  const destroy = () => {
    loadVersion += 1
    persister.destroy()
    store.destroy()
  }

  const undo = () => {
    const { nodes, edges, root } = store.getState()
    const prev = historyStack.undo({ nodes, edges, root })
    if (prev) {
      store.setState({ nodes: prev.nodes, edges: prev.edges, root: prev.root, isDirty: true })
      persister.schedule()
    }
  }

  const redo = () => {
    const { nodes, edges, root } = store.getState()
    const next = historyStack.redo({ nodes, edges, root })
    if (next) {
      store.setState({ nodes: next.nodes, edges: next.edges, root: next.root, isDirty: true })
      persister.schedule()
    }
  }

  const actions: WorkflowStoreActions = {
    load,
    persist: persister.flush,
    persistNow: persister.flush,
    select,
    toggleSelect,
    rangeSelect,
    discard,
    destroy,
    undo,
    redo,
    ...execution,
    ...expansion,
    toggleExpanded,
    ...mutations,
  }

  return { store, actions }
}

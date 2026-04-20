import { createStore, type Store } from '@shared/lib/store'
import { apiFetch } from '@shared/lib/base-api'
import type { WorkflowStoreState, WorkflowStoreActions } from './workflow-store-types'
import { INITIAL_WORKFLOW_STATE } from './workflow-store-types'
import { createDebouncedPersister } from './workflow-store-persistence'
import { bindMutationActions, type FormatMessage } from './workflow-store-mutations'
import { bindExecuteAction } from './workflow-store-execution'
import { bindExpansionActions } from './workflow-store-expansion'
import { retainExistingIds } from './workflow-store-set-utils'
import { computeRangeSelection } from './workflow-store-range-select'
import { deriveExpandedIdsFromNodes } from '../hooks/use-tree-expansion'

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
  })

  const persister = createDebouncedPersister(store, payload =>
    apiFetch(`/workflow/${workflowId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    }),
  )

  const mutations = bindMutationActions(store, persister, formatMessage)
  const execution = bindExecuteAction(store, persister)
  const expansion = bindExpansionActions(store, persister)

  const load = async () => {
    store.setState({ isLoading: true, error: null })
    try {
      const data = await apiFetch<WorkflowApiResponse>(`/workflow/${workflowId}`)
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
    persister.destroy()
    store.destroy()
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
    ...execution,
    ...expansion,
    ...mutations,
  }

  return { store, actions }
}

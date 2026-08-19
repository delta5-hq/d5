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
import { isCommandlessTextNode } from '@entities/workflow/lib'
import { deleteWorkflowFile, uploadWorkflowFile } from '../api/workflow-file-api'
import { toast } from 'sonner'
import { attachFileChildTransaction } from './workflow-attachment-transaction'

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
  const readWorkflow = async (id: string): Promise<Pick<WorkflowStoreState, 'nodes' | 'edges' | 'root'>> => {
    const data = await apiFetch<WorkflowApiResponse>(`/workflow/${id}`)
    return {
      nodes: (data.nodes ?? {}) as WorkflowStoreState['nodes'],
      edges: (data.edges ?? {}) as WorkflowStoreState['edges'],
      root: data.root,
    }
  }

  const mutations = bindMutationActions(store, persister, formatMessage, historyStack, {
    workflowId,
    deleteWorkflowFile,
    readWorkflow,
  })
  const execution = bindExecuteAction(store, persister)
  const expansion = bindExpansionActions(store, persister)

  const toggleExpanded = (nodeId: string): void => {
    const { nodes, expandedIds } = store.getState()
    const node = nodes[nodeId]
    const expanding = Boolean(node && !expandedIds.has(nodeId))
    // re-expand of a node that already has children must not overwrite user edits made since the first expand.
    const shouldMaterializeSplit =
      expanding && !!node && isCommandlessTextNode(node) && (node.children?.length ?? 0) === 0
    if (shouldMaterializeSplit) {
      mutations.importTextAsPrompts(nodeId, node.title ?? '')
    }
    expansion.toggleExpanded(nodeId)
    if (shouldMaterializeSplit) void persister.flush()
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
      const loadedNodes = Object.values(newNodes)
      const hasPersistedCheckedState = loadedNodes.some(node => 'checked' in node)
      const checkedIds = new Set(loadedNodes.filter(node => node.checked).map(node => node.id))
      const cleanedIds = hasPersistedCheckedState ? checkedIds : retainExistingIds(selectedIds, newNodes)
      const checkedSelectedId = hasPersistedCheckedState ? [...checkedIds].at(-1) : undefined
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
        ...(hasPersistedCheckedState
          ? { selectedId: checkedSelectedId }
          : selectionStale
            ? { selectedId: undefined }
            : {}),
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

  const commitSelection = (selectedIds: Set<string>, selectedId: string | undefined, anchorId?: string) => {
    store.setState({
      selectedId,
      selectedIds,
      anchorId,
    })
  }

  const select = (nodeId: string | undefined) => {
    commitSelection(nodeId ? new Set([nodeId]) : new Set<string>(), nodeId, nodeId)
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
    commitSelection(next, lastId, store.getState().anchorId)
  }

  const rangeSelect = (targetId: string, visibleOrder: readonly string[]) => {
    const { anchorId } = store.getState()
    const result = computeRangeSelection(anchorId, targetId, visibleOrder)
    if (result) {
      commitSelection(result.selectedIds, result.selectedId, store.getState().anchorId)
    } else {
      select(targetId)
    }
  }

  const toggleChecked = (nodeId: string) => {
    const current = store.getState()
    const node = current.nodes[nodeId]
    if (!node) return

    const nodes = { ...current.nodes, [nodeId]: { ...node, checked: !node.checked } }
    const selectedIds = new Set(
      Object.values(nodes)
        .filter(candidate => candidate.checked)
        .map(candidate => candidate.id),
    )
    const selectedId = nodes[nodeId].checked ? nodeId : [...selectedIds].at(-1)
    store.setState({
      nodes,
      selectedId,
      selectedIds,
      isDirty: true,
      dirtyNodeIds: new Set([...current.dirtyNodeIds, nodeId]),
    })
    persister.schedule()
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

  const onAttachmentError = (code: string): void => {
    toast.error(formatMessage({ id: code }))
  }

  const attachFileChild = async (parentId: string, file: File): Promise<string | null> =>
    attachFileChildTransaction(parentId, file, {
      store,
      persister,
      historyStack,
      workflowId,
      uploadFile: uploadWorkflowFile,
      deleteFile: deleteWorkflowFile,
      readWorkflow,
      expandNode: expansion.expandNode,
      select,
      onError: onAttachmentError,
    })

  const actions: WorkflowStoreActions = {
    load,
    persist: persister.flush,
    persistNow: persister.flush,
    select,
    toggleSelect,
    rangeSelect,
    toggleChecked,
    discard,
    destroy,
    undo,
    redo,
    attachFileChild,
    ...execution,
    ...expansion,
    toggleExpanded,
    ...mutations,
  }

  return { store, actions }
}

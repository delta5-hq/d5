import type { Store } from '@shared/lib/store'
import type { NodeId } from '@shared/base-types'
import { addChildNode, removeNode as removeNodePure } from '@entities/workflow/lib'
import type { WorkflowStoreState, ReadWorkflowFn } from './workflow-store-types'
import type { DebouncedPersister } from './workflow-store-persistence'
import type { HistoryStack } from './workflow-store-history'
import type { WorkflowFileUploadResponse } from '../api/workflow-file-api'

interface AttachmentTransactionDeps {
  store: Store<WorkflowStoreState>
  persister: DebouncedPersister
  historyStack: HistoryStack
  workflowId: string
  uploadFile: (workflowId: string, file: File) => Promise<WorkflowFileUploadResponse>
  deleteFile: (workflowId: string, fileId: string) => Promise<void>
  readWorkflow: ReadWorkflowFn
  expandNode: (nodeId: NodeId) => void
  select: (nodeId: NodeId | undefined) => void
  onError: (code: string) => void
}

function attachmentNode(uploaded: WorkflowFileUploadResponse): { title: string; file: string } {
  return { title: uploaded.filename, file: uploaded.id }
}

function persistDirty(store: Store<WorkflowStoreState>, persister: DebouncedPersister): Promise<boolean> {
  store.setState({ isDirty: true })
  return persister.flush()
}

async function confirmPersistedAttachmentLink(
  deps: AttachmentTransactionDeps,
  nodeId: NodeId,
  uploaded: WorkflowFileUploadResponse,
): Promise<boolean> {
  try {
    const persisted = await deps.readWorkflow(deps.workflowId)
    return persisted.nodes[nodeId]?.file === uploaded.id
  } catch {
    return false
  }
}

function createLocalFileNode(
  store: Store<WorkflowStoreState>,
  parentId: NodeId,
  uploaded: WorkflowFileUploadResponse,
): NodeId {
  const result = addChildNode(store.getState().nodes, parentId, attachmentNode(uploaded))
  store.setState({ nodes: result.nodes, isDirty: true })
  return result.newId
}

async function removePersistedAttachmentNode(deps: AttachmentTransactionDeps, nodeId: NodeId): Promise<boolean> {
  const { store, persister } = deps
  const current = store.getState()
  const next = removeNodePure(current.nodes, current.edges, nodeId)
  store.setState({
    nodes: next.nodes,
    edges: next.edges,
    selectedId: undefined,
    selectedIds: new Set<NodeId>(),
    anchorId: undefined,
    isDirty: true,
  })
  if (await persister.flush()) return true

  const restoredNode = current.nodes[nodeId]
  if (restoredNode) {
    store.setState({
      nodes: current.nodes,
      edges: current.edges,
      selectedId: nodeId,
      selectedIds: new Set([nodeId]),
      anchorId: nodeId,
      isDirty: true,
    })
  }
  deps.onError('workflowTree.attachment.removeFlushFailed')
  return false
}

async function compensateFailedLink(
  deps: AttachmentTransactionDeps,
  nodeId: NodeId,
  uploaded: WorkflowFileUploadResponse,
): Promise<NodeId | null> {
  const { workflowId, deleteFile, historyStack } = deps

  try {
    await deleteFile(workflowId, uploaded.id)
  } catch {
    historyStack.clear()
    deps.onError('workflowTree.attachment.deleteFailed')
    return null
  }

  historyStack.clear()
  if (await removePersistedAttachmentNode(deps, nodeId)) {
    deps.onError('workflowTree.attachment.linkPersistFailed')
  }
  return null
}

export async function attachFileChildTransaction(
  parentId: NodeId,
  file: File,
  deps: AttachmentTransactionDeps,
): Promise<NodeId | null> {
  const { store, persister, historyStack, workflowId, uploadFile, deleteFile, expandNode, select } = deps
  if (!store.getState().nodes[parentId]) {
    deps.onError('workflowTree.attachment.localCreateFailed')
    return null
  }

  let uploaded: WorkflowFileUploadResponse
  try {
    uploaded = await uploadFile(workflowId, file)
  } catch (error) {
    deps.onError('workflowTree.attachment.uploadFailed')
    throw error
  }

  try {
    historyStack.checkpoint({
      nodes: store.getState().nodes,
      edges: store.getState().edges,
      root: store.getState().root,
    })
    const newId = createLocalFileNode(store, parentId, uploaded)

    expandNode(parentId)
    select(newId)

    if ((await persistDirty(store, persister)) && (await confirmPersistedAttachmentLink(deps, newId, uploaded))) {
      historyStack.clear()
      return newId
    }

    return compensateFailedLink(deps, newId, uploaded)
  } catch {
    historyStack.clear()
    try {
      await deleteFile(workflowId, uploaded.id)
    } catch {
      deps.onError('workflowTree.attachment.deleteFailed')
    }
    return null
  }
}

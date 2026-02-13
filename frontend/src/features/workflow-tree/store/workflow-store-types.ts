import type { NodeData, NodeId, EdgeData, EdgeId, Share } from '@shared/base-types'

export interface WorkflowStoreState {
  workflowId: string
  nodes: Record<NodeId, NodeData>
  edges: Record<EdgeId, EdgeData>
  root: NodeId | undefined
  share: Share | undefined
  selectedId: NodeId | undefined

  isLoading: boolean
  error: Error | null
  isDirty: boolean
  isSaving: boolean
  executingNodeIds: Set<NodeId>
}

export interface WorkflowStoreActions {
  load: () => Promise<void>
  persist: () => Promise<boolean>
  persistNow: () => Promise<boolean>
  discard: () => void
  destroy: () => void

  select: (nodeId: NodeId | undefined) => void
  createRoot: (nodeData: Partial<NodeData>) => NodeId | null
  addChild: (parentId: NodeId, nodeData: Partial<NodeData>) => NodeId | null
  updateNode: (nodeId: NodeId, updates: Partial<Omit<NodeData, 'id' | 'parent'>>) => boolean
  removeNode: (nodeId: NodeId) => boolean
  moveNode: (nodeId: NodeId, newParentId: NodeId) => boolean
  duplicateNode: (nodeId: NodeId, targetParentId?: NodeId) => NodeId | null

  executeCommand: (node: NodeData, queryType: string) => Promise<boolean>
}

export const INITIAL_WORKFLOW_STATE: Omit<WorkflowStoreState, 'workflowId'> = {
  nodes: {},
  edges: {},
  root: undefined,
  share: undefined,
  selectedId: undefined,
  isLoading: false,
  error: null,
  isDirty: false,
  isSaving: false,
  executingNodeIds: new Set<NodeId>(),
}

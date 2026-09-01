import type { NodeData, NodeId, EdgeData, EdgeId, Share } from '@shared/base-types'

export interface WorkflowStoreState {
  workflowId: string
  nodes: Record<NodeId, NodeData>
  edges: Record<EdgeId, EdgeData>
  root: NodeId | undefined
  share: Share | undefined
  selectedId: NodeId | undefined
  selectedIds: Set<NodeId>
  anchorId: NodeId | undefined
  expandedIds: Set<NodeId>

  isLoading: boolean
  error: Error | null
  isDirty: boolean
  isSaving: boolean
  dirtyNodeIds: Set<NodeId>
  executingNodeIds: Set<NodeId>
  // Fan-out targets whose spark is scheduled but has not yet reached them. While a
  // target is here it renders as clipboard (no command pill, no thought tail); it
  // switches to its full command presentation when the spark arrives (results reveal).
  pendingFanOutTargetIds: Set<NodeId>
}

export interface WorkflowStoreActions {
  load: () => Promise<void>
  persist: () => Promise<boolean>
  persistNow: () => Promise<boolean>
  discard: () => void
  destroy: () => void

  select: (nodeId: NodeId | undefined) => void
  toggleSelect: (nodeId: NodeId) => void
  rangeSelect: (targetId: NodeId, visibleOrder: readonly string[]) => void
  toggleChecked: (nodeId: NodeId) => void

  toggleExpanded: (nodeId: NodeId) => void
  expandNode: (nodeId: NodeId) => void
  collapseNode: (nodeId: NodeId) => void

  createRoot: (nodeData: Partial<NodeData>) => NodeId | null
  addChild: (parentId: NodeId, nodeData: Partial<NodeData>) => NodeId | null
  addSibling: (nodeId: NodeId, nodeData: Partial<NodeData>) => NodeId | null
  addPromptChild: (parentId: NodeId, nodeData: Partial<NodeData>) => NodeId | null
  removePromptChildren: (parentId: NodeId) => boolean
  updateNode: (nodeId: NodeId, updates: Partial<Omit<NodeData, 'id' | 'parent'>>) => boolean
  removeNode: (nodeId: NodeId) => boolean
  removeNodes: (nodeIds: Set<NodeId>) => number
  moveNode: (nodeId: NodeId, newParentId: NodeId, insertionIndex?: number) => boolean
  duplicateNode: (nodeId: NodeId, targetParentId?: NodeId) => NodeId | null
  importTextAsPrompts: (parentId: NodeId, text: string) => number
  attachFileChild: (parentId: NodeId, file: File) => Promise<NodeId | null>

  executeCommand: (node: NodeData, queryType: string) => Promise<boolean>
  abortExecution: (nodeId: NodeId) => void

  wrapNodes: (nodeIds: Set<NodeId>) => NodeId | null
  undo: () => void
  redo: () => void
}

export type ReadWorkflowFn = (workflowId: string) => Promise<Pick<WorkflowStoreState, 'nodes' | 'edges' | 'root'>>

export const INITIAL_WORKFLOW_STATE: Omit<WorkflowStoreState, 'workflowId'> = {
  nodes: {},
  edges: {},
  root: undefined,
  share: undefined,
  selectedId: undefined,
  selectedIds: new Set<NodeId>(),
  anchorId: undefined,
  expandedIds: new Set<NodeId>(),
  isLoading: false,
  error: null,
  isDirty: false,
  isSaving: false,
  dirtyNodeIds: new Set<NodeId>(),
  executingNodeIds: new Set<NodeId>(),
  pendingFanOutTargetIds: new Set<NodeId>(),
}

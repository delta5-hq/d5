import type React from 'react'

export type MCPToolCallRecord = {
  alias: string
  exposedName: string
  toolName: string
  status: string
  reason?: string
}

export type MCPAvailabilityRecord = {
  alias: string
  toolNames: string[]
}

export type MCPUnavailabilityRecord = {
  alias: string
  phase: string
  reason: string
}

export type MCPFusionReportData = {
  available: MCPAvailabilityRecord[]
  unavailable: MCPUnavailabilityRecord[]
  toolCalls: MCPToolCallRecord[]
}

export type WorkflowId = string

export type NodeId = string

export type EdgeId = string

export type ObjectId = string

export type MediaPositions = 'crop' | 'body' | 'stretch'

export type NodeContent = {
  id?: NodeId
  children?: NodeId[]
  prompts?: NodeId[]
  image?: ObjectId
  uml?: ObjectId
  imagePosition?: MediaPositions
  video?: string
  file?: ObjectId
  title?: string
  color?: string
  borderColor?: string
  scale?: number
  tags?: string[]
  checked?: boolean
  hasComments?: boolean
  autoshrink?: boolean
  dirty?: boolean
  command?: string
  collapsed?: boolean
  parent?: NodeId
  mcpFusionReport?: MCPFusionReportData
  reliabilityMetadata?: ReliabilityMetadata
  executionStatus?: 'error'
  /** Container config for grouping children */
  container?: {
    type: string
    /** IDs of children to include in container. If omitted, includes all immediate children */
    childrenIds?: NodeId[]
    paddingTop?: number
    paddingBottom?: number
    component?: (props: { children: React.ReactNode; depth: number; parentNode: unknown }) => React.ReactNode
  }
}

export type NodeData = NodeContent & {
  id: NodeId
}

export type NodeDatas = Record<NodeId, NodeData>

export type ForkRanking = {
  forkIndex: number
  rank: number
}

export type JudgeQualityWarning = {
  condition:
    | 'singleProvider'
    | 'lowestTierOnly'
    | 'juryDuplicates'
    | 'fallbackWithWeakJudge'
    | 'noReasoningMode'
    | 'allGateFiltered'
    | 'degradedInput'
    | 'commodityPartialSuccess'
  severity: 'high' | 'medium' | 'low'
}

export type CriterionVerdict = {
  criterionId: string
  criterion: string
  forkRankings: ForkRanking[]
}

export type DiscardedFork = {
  forkIndex: number
  status: 'ok' | 'criteria-failed' | 'runtime-failed'
  failedAt?: string
  reason?: string
  attempts?: number
}

export type ReliabilityMetadata = {
  winnerForkIndex: number | null
  perCriterionVerdict: CriterionVerdict[]
  mode: 'strict' | 'fallback' | 'commodity' | 'invalid' | 'suppressed'
  selectionLayer: 'primary' | 'fallback' | 'none'
  noSignal: boolean
  /** best-of-N was collapsed to a single execution (e.g. side-effecting MCP/RPC alias) */
  suppressed?: boolean
  /** why the run was collapsed to one, e.g. 'side-effecting-alias' */
  cause?: string
  /** the N originally requested via commodity :n=N before suppression */
  requestedN?: number
  tiebreakUsed?: boolean
  fallbackUsed?: boolean
  generatorOnlyJudge?: boolean
  judgeReasoningRequested?: boolean
  eligible: number
  total: number
  failureCause?:
    | 'structural-gate'
    | 'criteria-failed'
    | 'runtime-failed'
    | 'no-eligible-forks'
    | 'no-judge-signal'
    | 'missing-parent'
    | 'invalid-criteria'
  remediationHint?: 'revise-prompt' | 'check-provider' | 'adjust-criteria' | 'none'
  allGateFiltered?: boolean
  judgeInput?: JudgeInputMetadata
  judgeQualityWarnings?: JudgeQualityWarning[]
  discardedForks?: DiscardedFork[]
}

export type JudgeInputMetadata = {
  candidateCount: number
  perForkBudgetChars: number
  degradedInput: boolean
  resolvedJudgeFamilies: string[]
}

export type EdgeContent = {
  id?: EdgeId
  start: NodeId
  end: NodeId
  title?: string
  color?: string
}

export type EdgeData = EdgeContent & {
  id: EdgeId
  title?: string
  color?: string
}

export type EdgeDatas = Record<EdgeId, EdgeData>

export type NodeTagId = string

export type NodeTagData = {
  id: NodeTagId
  name: string
  color: string
}

export type NodeTagDatas = NodeTagData[]

export type WorkflowContentData = {
  nodes: NodeDatas
  edges?: EdgeDatas
  root: NodeId
  tags?: NodeTagDatas
  share: Share
  category?: string
}

export interface Template extends Omit<WorkflowContentData, 'share' | 'category'> {
  _id: string
  name: string
  keywords: string[]
  backgroundImage: string
}

export enum AccessRole {
  owner = 'owner',
  contributor = 'contributor',
  reader = 'reader',
}

export interface RoleBinding {
  subjectId: string
  subjectType: 'user' | 'group' | 'mail'
  role: AccessRole
}

export interface PublicShare {
  enabled?: boolean
  hidden?: boolean
  writeable?: boolean
}

export interface Share {
  public?: PublicShare
  access: RoleBinding[]
}

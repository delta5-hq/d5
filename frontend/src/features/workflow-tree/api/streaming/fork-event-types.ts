// Mirror of backend ForkStreamEvent.js + ForkLeafExtractor.js shapes.

export type ForkEventType = 'fork_started' | 'fork_settled' | 'refine_complete'

export interface ForkLeafOutput {
  nodeId: string
  content: string
}

export interface ForkStartedEvent {
  type: 'fork_started'
  refineNodeId: string
  forkIndex: number
  total: number
}

export interface ForkSettledEvent {
  type: 'fork_settled'
  refineNodeId: string
  forkIndex: number
  status: 'ok' | 'criteria-failed' | 'runtime-failed'
  failedAt?: string
  reason?: string
  leafOutputs?: ForkLeafOutput[]
}

export interface RefineCompleteEvent {
  type: 'refine_complete'
  refineNodeId: string
  winnerForkIndex: number | null
  total: number
}

export type ForkEvent = ForkStartedEvent | ForkSettledEvent | RefineCompleteEvent

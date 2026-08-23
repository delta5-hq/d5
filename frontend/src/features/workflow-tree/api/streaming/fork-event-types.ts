// Mirror of backend ForkStreamEvent.js + ForkLeafExtractor.js shapes.

export type ForkEventType = 'fork_started' | 'fork_settled' | 'elect_complete'

export interface ForkLeafOutput {
  nodeId: string
  content: string
}

export interface ForkStartedEvent {
  type: 'fork_started'
  electNodeId: string
  forkIndex: number
  total: number
}

export interface ForkSettledEvent {
  type: 'fork_settled'
  electNodeId: string
  forkIndex: number
  status: 'ok' | 'criteria-failed' | 'runtime-failed'
  failedAt?: string
  reason?: string
  leafOutputs?: ForkLeafOutput[]
}

export interface ElectCompleteEvent {
  type: 'elect_complete'
  electNodeId: string
  winnerForkIndex: number | null
  total: number
}

export type ForkEvent = ForkStartedEvent | ForkSettledEvent | ElectCompleteEvent

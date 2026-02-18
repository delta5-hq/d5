import type { NodeId } from '@shared/base-types'
import type { GenieState } from '@shared/ui/genie'
import { updateGenieState } from '@shared/lib/genie-state-api'

export function notifyExecutionStarted(nodeId: NodeId): void {
  updateGenieState(nodeId, 'busy')
}

export function notifyExecutionCompleted(nodeId: NodeId, success: boolean): void {
  const finalState: GenieState = success ? 'done-success' : 'done-failure'
  updateGenieState(nodeId, finalState)
}

export function notifyExecutionAborted(nodeId: NodeId): void {
  updateGenieState(nodeId, 'idle')
}

import type { NodeId } from '@shared/base-types'
import type { ForkEvent, ForkLeafOutput } from '../api/streaming/fork-event-types'

export type ForkPreviewStatus = 'pending' | 'ok' | 'criteria-failed' | 'runtime-failed'

export interface ForkPreviewEntry {
  forkIndex: number
  status: ForkPreviewStatus
  failedAt?: string
  reason?: string
  leafOutputs?: ForkLeafOutput[]
}

export interface ForkPreviewState {
  total: number
  forks: readonly ForkPreviewEntry[]
  winnerForkIndex: number | null
}

export function applyForkEventToMap(
  map: Map<NodeId, ForkPreviewState>,
  event: ForkEvent,
): Map<NodeId, ForkPreviewState> {
  const next = new Map(map)

  if (event.type === 'fork_started') {
    const current = next.get(event.refineNodeId)
    const existingForks = current?.forks ?? []
    next.set(event.refineNodeId, {
      total: event.total,
      forks: [...existingForks, { forkIndex: event.forkIndex, status: 'pending' }],
      winnerForkIndex: null,
    })
  } else if (event.type === 'fork_settled') {
    const current = next.get(event.refineNodeId)
    if (current) {
      const updatedForks = current.forks.map(f =>
        f.forkIndex === event.forkIndex
          ? {
              ...f,
              status: event.status as ForkPreviewStatus,
              ...(event.failedAt !== undefined ? { failedAt: event.failedAt } : {}),
              ...(event.reason !== undefined ? { reason: event.reason } : {}),
              ...(event.leafOutputs !== undefined ? { leafOutputs: event.leafOutputs } : {}),
            }
          : f,
      )
      next.set(event.refineNodeId, { ...current, forks: updatedForks })
    }
  } else if (event.type === 'refine_complete') {
    const current = next.get(event.refineNodeId)
    if (current) {
      next.set(event.refineNodeId, { ...current, winnerForkIndex: event.winnerForkIndex })
    }
  }

  return next
}

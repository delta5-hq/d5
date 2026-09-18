import type { NodeData, NodeId, EdgeData, EdgeId } from '@shared/base-types'

export interface HistorySnapshot {
  nodes: Record<NodeId, NodeData>
  edges: Record<EdgeId, EdgeData>
  root: NodeId | undefined
}

export interface HistoryStack {
  checkpoint(snapshot: HistorySnapshot): void
  undo(current: HistorySnapshot): HistorySnapshot | undefined
  redo(current: HistorySnapshot): HistorySnapshot | undefined
  clear(): void
}

const MAX_SNAPSHOTS = 50

export function createHistoryStack(): HistoryStack {
  const undos: HistorySnapshot[] = []
  const redos: HistorySnapshot[] = []

  return {
    checkpoint(snapshot) {
      undos.push(snapshot)
      if (undos.length > MAX_SNAPSHOTS) undos.shift()
      redos.length = 0
    },
    undo(current) {
      const prev = undos.pop()
      if (!prev) return undefined
      redos.push(current)
      return prev
    },
    redo(current) {
      const next = redos.pop()
      if (!next) return undefined
      undos.push(current)
      return next
    },
    clear() {
      undos.length = 0
      redos.length = 0
    },
  }
}

import type { Store } from '@shared/lib/store'
import type { NodeId, EdgeId, NodeData, EdgeData } from '@shared/base-types'
import type { WorkflowStoreState } from './workflow-store-types'

const DEBOUNCE_MS = 500

export interface DebouncedPersister {
  schedule: () => void
  flush: () => Promise<boolean>
  cancel: () => void
  destroy: () => void
}

export function createDebouncedPersister(
  store: Store<WorkflowStoreState>,
  saveFn: (payload: {
    nodes: Record<NodeId, NodeData>
    edges: Record<EdgeId, EdgeData>
    root?: string
  }) => Promise<unknown>,
): DebouncedPersister {
  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlight: Promise<boolean> | null = null

  const cancel = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  const performFlush = async (): Promise<boolean> => {
    cancel()
    while (store.getState().isDirty) {
      const { nodes, edges, root } = store.getState()
      store.setState({ isSaving: true })
      try {
        await saveFn({ nodes, edges, root })
      } catch {
        store.setState({ isSaving: false })
        return false
      }

      const current = store.getState()
      const savedCurrentState = current.nodes === nodes && current.edges === edges && current.root === root
      if (savedCurrentState) {
        store.setState({ isDirty: false, isSaving: false, dirtyNodeIds: new Set() })
      }
    }
    store.setState({ isSaving: false })
    return true
  }

  const flush = (): Promise<boolean> => {
    if (inFlight) return inFlight
    inFlight = performFlush().finally(() => {
      inFlight = null
    })
    return inFlight
  }

  const schedule = () => {
    cancel()
    timer = setTimeout(() => {
      flush()
    }, DEBOUNCE_MS)
  }

  const destroy = () => {
    cancel()
  }

  return { schedule, flush, cancel, destroy }
}

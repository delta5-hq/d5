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

  const cancel = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  const flush = async (): Promise<boolean> => {
    cancel()
    const { isDirty, nodes, edges, root } = store.getState()
    if (!isDirty) return true

    store.setState({ isSaving: true })
    try {
      await saveFn({ nodes, edges, root })
      store.setState({ isDirty: false, isSaving: false })
      return true
    } catch (err) {
      store.setState({ isSaving: false })
      return false
    }
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

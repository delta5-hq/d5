import { useSyncExternalStore } from 'react'
import { genieStateStore, type GenieState } from './genie-state-store'

export function useGenieState(nodeId: string): GenieState {
  return useSyncExternalStore(
    callback => genieStateStore.subscribe(nodeId, callback),
    () => genieStateStore.getSnapshot(nodeId),
    () => genieStateStore.getServerSnapshot(nodeId),
  )
}

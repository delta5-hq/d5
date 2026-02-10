import { genieStateStore } from './genie-state-store'
import type { GenieState } from '@shared/ui/genie'

export function updateGenieState(nodeId: string, state: GenieState): void {
  genieStateStore.setState(nodeId, state)
}

export function batchUpdateGenieState(updates: Array<{ nodeId: string; state: GenieState }>): void {
  genieStateStore.batchSetState(updates)
}

export function hydrateGenieStates(nodeStates: Record<string, GenieState>): void {
  genieStateStore.hydrate(nodeStates)
}

export function deleteGenieState(nodeId: string): void {
  genieStateStore.deleteNode(nodeId)
}

export function clearAllGenieStates(): void {
  genieStateStore.clearAll()
}

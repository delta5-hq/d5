import type { GenieState } from '@shared/ui/genie'
import { ProgressStreamClient } from './progress-stream-client'

export type { GenieState }

type Listener = () => void
type Unsubscribe = () => void

export class GenieStateStore {
  private stateMap = new Map<string, GenieState>()
  private errorMap = new Map<string, string>()
  private listenersByNodeId = new Map<string, Set<Listener>>()
  private globalListeners = new Set<Listener>()
  private streamClient: ProgressStreamClient | null = null

  connectToProgressStream(baseUrl: string): void {
    if (this.streamClient) return

    this.streamClient = new ProgressStreamClient(baseUrl, (nodeId, state, error) => {
      this.setState(nodeId, state)
      if (error) {
        this.setError(nodeId, error)
      } else {
        this.clearError(nodeId)
      }

      if (state === 'done-success' || state === 'done-failure') {
        setTimeout(() => {
          if (this.stateMap.get(nodeId) === state) {
            this.setState(nodeId, 'idle')
          }
        }, 3000)
      }
    })

    this.streamClient.connect()
  }

  disconnectFromProgressStream(): void {
    this.streamClient?.disconnect()
    this.streamClient = null
  }

  subscribe(nodeId: string, listener: Listener): Unsubscribe {
    if (!this.listenersByNodeId.has(nodeId)) {
      this.listenersByNodeId.set(nodeId, new Set())
    }
    this.listenersByNodeId.get(nodeId)!.add(listener)

    return () => {
      const listeners = this.listenersByNodeId.get(nodeId)
      if (listeners) {
        listeners.delete(listener)
        if (listeners.size === 0) {
          this.listenersByNodeId.delete(nodeId)
        }
      }
    }
  }

  getSnapshot(nodeId: string): GenieState {
    return this.stateMap.get(nodeId) ?? 'idle'
  }

  getServerSnapshot(nodeId: string): GenieState {
    return this.stateMap.get(nodeId) ?? 'idle'
  }

  setState(nodeId: string, state: GenieState): void {
    const previousState = this.stateMap.get(nodeId) ?? 'idle'
    if (previousState === state) return

    this.stateMap.set(nodeId, state)
    this.notifyNodeListeners(nodeId)
    this.notifyGlobalListeners()
  }

  batchSetState(updates: Array<{ nodeId: string; state: GenieState }>): void {
    const changedNodeIds = new Set<string>()

    for (const { nodeId, state } of updates) {
      const previousState = this.stateMap.get(nodeId) ?? 'idle'
      if (previousState !== state) {
        this.stateMap.set(nodeId, state)
        changedNodeIds.add(nodeId)
      }
    }

    for (const nodeId of changedNodeIds) {
      this.notifyNodeListeners(nodeId)
    }

    if (changedNodeIds.size > 0) {
      this.notifyGlobalListeners()
    }
  }

  hydrate(nodeStates: Record<string, GenieState>): void {
    for (const [nodeId, state] of Object.entries(nodeStates)) {
      this.stateMap.set(nodeId, state)
    }
  }

  deleteNode(nodeId: string): void {
    this.stateMap.delete(nodeId)
    this.errorMap.delete(nodeId)
    this.listenersByNodeId.delete(nodeId)
  }

  clearAll(): void {
    this.stateMap.clear()
    this.errorMap.clear()
    this.listenersByNodeId.clear()
  }

  getError(nodeId: string): string | undefined {
    return this.errorMap.get(nodeId)
  }

  setError(nodeId: string, error: string): void {
    this.errorMap.set(nodeId, error)
    this.notifyNodeListeners(nodeId)
    this.notifyGlobalListeners()
  }

  clearError(nodeId: string): void {
    this.errorMap.delete(nodeId)
    this.notifyNodeListeners(nodeId)
    this.notifyGlobalListeners()
  }

  reconcile(validNodeIds: Set<string>): void {
    const nodeIdsToDelete: string[] = []

    for (const nodeId of this.stateMap.keys()) {
      if (!validNodeIds.has(nodeId)) {
        nodeIdsToDelete.push(nodeId)
      }
    }

    for (const nodeId of nodeIdsToDelete) {
      this.deleteNode(nodeId)
    }
  }

  subscribeToAll(listener: Listener): Unsubscribe {
    this.globalListeners.add(listener)
    return () => this.globalListeners.delete(listener)
  }

  getAllStates(): Map<string, GenieState> {
    return new Map(this.stateMap)
  }

  getListenerCount(nodeId: string): number {
    return this.listenersByNodeId.get(nodeId)?.size ?? 0
  }

  private notifyNodeListeners(nodeId: string): void {
    this.listenersByNodeId.get(nodeId)?.forEach(listener => listener())
  }

  private notifyGlobalListeners(): void {
    this.globalListeners.forEach(listener => listener())
  }
}

export const genieStateStore = new GenieStateStore()

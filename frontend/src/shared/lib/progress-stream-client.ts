import type { GenieState } from '@shared/ui/genie'

type ProgressEvent = {
  type: 'connected' | 'progress'
  nodeId?: string
  state?: GenieState
  timestamp: number
  error?: string
}

type ConnectionStatusListener = (connected: boolean) => void
type ErrorListener = (error: Error) => void

export class ProgressStreamClient {
  private eventSource: EventSource | null = null
  private connectionListeners = new Set<ConnectionStatusListener>()
  private errorListeners = new Set<ErrorListener>()
  private isConnected = false

  constructor(
    private baseUrl: string,
    private onProgress: (nodeId: string, state: GenieState) => void,
  ) {}

  connect(): void {
    if (this.eventSource) return

    this.eventSource = new EventSource(`${this.baseUrl}/api/v2/progress/stream`)

    this.eventSource.onopen = () => {
      this.isConnected = true
      this.notifyConnectionListeners(true)
    }

    this.eventSource.onmessage = event => {
      try {
        const data: ProgressEvent = JSON.parse(event.data)

        if (data.type === 'progress' && data.nodeId && data.state) {
          this.onProgress(data.nodeId, data.state)
        }
      } catch (error) {
        this.notifyErrorListeners(error instanceof Error ? error : new Error('Failed to parse SSE message'))
      }
    }

    this.eventSource.onerror = () => {
      this.isConnected = false
      this.notifyConnectionListeners(false)

      if (this.eventSource?.readyState === EventSource.CLOSED) {
        this.eventSource = null
        setTimeout(() => this.connect(), 3000)
      }
    }
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
      this.isConnected = false
      this.notifyConnectionListeners(false)
    }
  }

  onConnectionChange(listener: ConnectionStatusListener): () => void {
    this.connectionListeners.add(listener)
    return () => this.connectionListeners.delete(listener)
  }

  onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener)
    return () => this.errorListeners.delete(listener)
  }

  getConnectionStatus(): boolean {
    return this.isConnected
  }

  private notifyConnectionListeners(connected: boolean): void {
    this.connectionListeners.forEach(listener => listener(connected))
  }

  private notifyErrorListeners(error: Error): void {
    this.errorListeners.forEach(listener => listener(error))
  }
}

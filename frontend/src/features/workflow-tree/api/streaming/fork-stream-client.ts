import { API_BASE_PATH } from '@shared/config/api'
import type { ForkEvent } from './fork-event-types'

export interface ForkStreamCallbacks {
  onForkEvent: (event: ForkEvent) => void
  onError?: (error: Error) => void
}

// Only `update`-type SSE messages carry fork events — `complete` and `error`
// are resolved through the concurrent POST response instead.
export class ForkStreamClient {
  private eventSource: EventSource | null = null

  constructor(
    private readonly sessionId: string,
    private readonly callbacks: ForkStreamCallbacks,
  ) {}

  connect(): void {
    if (this.eventSource) return

    const url = `${API_BASE_PATH}/execute/stream?sessionId=${encodeURIComponent(this.sessionId)}`
    this.eventSource = new EventSource(url, { withCredentials: true })

    this.eventSource.onmessage = event => {
      try {
        const parsed = JSON.parse(event.data as string) as { type: string; data: unknown }
        if (parsed.type === 'update') {
          this.callbacks.onForkEvent(parsed.data as ForkEvent)
        }
      } catch {
        this.callbacks.onError?.(new Error(`Malformed SSE payload: ${String(event.data)}`))
      }
    }

    this.eventSource.onerror = () => {
      this.callbacks.onError?.(new Error('SSE connection error'))
    }
  }

  disconnect(): void {
    this.eventSource?.close()
    this.eventSource = null
  }
}

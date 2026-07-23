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
  private openPromise: Promise<void> | null = null

  constructor(
    private readonly sessionId: string,
    private readonly callbacks: ForkStreamCallbacks,
  ) {}

  connect(): void {
    if (this.eventSource) return

    const url = `${API_BASE_PATH}/execute/stream?sessionId=${encodeURIComponent(this.sessionId)}`
    const source = new EventSource(url, { withCredentials: true })
    this.eventSource = source

    // The execute POST carries this same sessionId, but the backend can only route fork events
    // to a session the SSE GET has already registered (StreamController.attachReader registers on
    // connect). Capture an open signal so callers can gate the POST on it — firing the POST before
    // the session exists races registration and 400s the execution, dropping the parent's output.
    this.openPromise = new Promise<void>(resolve => {
      source.onopen = () => resolve()
    })

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

  // Resolve once the SSE session is established server-side (onopen), so a caller can await this
  // before firing the concurrent execute POST. Falls back after timeoutMs so a stalled or failed
  // SSE never blocks execution indefinitely — a best-effort gate, not a hard dependency.
  async whenReady(timeoutMs = 3000): Promise<void> {
    if (!this.openPromise) return
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        this.openPromise,
        new Promise<void>(resolve => {
          timer = setTimeout(resolve, timeoutMs)
        }),
      ])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  disconnect(): void {
    this.eventSource?.close()
    this.eventSource = null
    this.openPromise = null
  }
}

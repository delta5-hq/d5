import { EventSourcePolyfill } from "event-source-polyfill"
import { API_ROOT } from "../../configuration"

export interface SSEConnectionConfig {
  sessionId: string
  apiVersion: string
  authToken: string
  openTimeoutMs?: number
}

export interface SSEMessage {
  type: "progress" | "update" | "error" | "complete"
  data: unknown
  timestamp: number
}

export type SSEMessageHandler = (message: SSEMessage) => void

export class SSEConnection {
  private eventSource: EventSourcePolyfill | null = null
  private readonly config: SSEConnectionConfig
  private messageHandler: SSEMessageHandler | null = null

  constructor(config: SSEConnectionConfig) {
    this.config = config
  }

  async open(): Promise<void> {
    if (this.eventSource) {
      this.close()
    }

    const url = `${API_ROOT}${this.config.apiVersion}/execute/stream?sessionId=${encodeURIComponent(this.config.sessionId)}`

    this.eventSource = new EventSourcePolyfill(url, {
      headers: {
        Authorization: `Bearer ${this.config.authToken}`,
      },
    })

    this.eventSource.onmessage = (event) => {
      this.handleRawMessage(event as MessageEvent)
    }
  }

  waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.eventSource) {
        return reject(new Error("EventSource not initialized"))
      }

      const timeoutMs = this.config.openTimeoutMs ?? 3000
      const timeout = setTimeout(() => {
        reject(new Error("SSE connection timeout"))
      }, timeoutMs)

      this.eventSource.onopen = () => {
        clearTimeout(timeout)
        resolve()
      }

      this.eventSource.onerror = () => {
        clearTimeout(timeout)
        if (this.eventSource?.readyState === EventSource.CLOSED) {
          reject(new Error("SSE connection failed"))
        }
      }
    })
  }

  onMessage(handler: SSEMessageHandler): void {
    this.messageHandler = handler
  }

  close(): void {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    this.messageHandler = null
  }

  isOpen(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN
  }

  private handleRawMessage(event: MessageEvent): void {
    if (!this.messageHandler) {
      return
    }

    try {
      const parsed = JSON.parse(event.data) as SSEMessage
      this.messageHandler(parsed)
    } catch (error) {
      console.error("Failed to parse SSE message:", error, event.data)
    }
  }
}

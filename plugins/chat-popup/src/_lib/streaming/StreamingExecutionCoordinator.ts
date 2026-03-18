import { SSEConnection } from "./SSEConnection"
import { ProgressFormatter, ProgressMessage } from "./ProgressFormatter"
import type { NodeData } from "../../_interfaces"

export interface ExecutionParams {
  apiVersion: string
  authToken: string
  executeRequest: (payload: Record<string, unknown>) => Promise<NodeData[]>
  payload: Record<string, unknown>
}

export type ProgressCallback = (message: ProgressMessage) => void

export class StreamingExecutionCoordinator {
  private readonly formatter = new ProgressFormatter()

  async execute(params: ExecutionParams, onProgress?: ProgressCallback): Promise<NodeData[]> {
    const sessionId = this.generateSessionId()
    const connection = new SSEConnection({
      sessionId,
      apiVersion: params.apiVersion,
      authToken: params.authToken,
    })

    try {
      const shouldUseStreaming = await this.tryEstablishStreaming(connection, onProgress)

      if (shouldUseStreaming) {
        this.attachStreamHandlers(connection, onProgress)
      }

      const payloadWithSession = shouldUseStreaming
        ? { ...params.payload, streamSessionId: sessionId }
        : params.payload

      const result = await params.executeRequest(payloadWithSession)
      return result
    } finally {
      connection.close()
    }
  }

  private async tryEstablishStreaming(
    connection: SSEConnection,
    onProgress?: ProgressCallback,
  ): Promise<boolean> {
    if (!onProgress) {
      return false
    }

    try {
      await connection.open()
      await connection.waitForReady()
      return true
    } catch (error) {
      console.warn("SSE unavailable, falling back to POST-only:", error)
      return false
    }
  }

  private attachStreamHandlers(connection: SSEConnection, onProgress?: ProgressCallback): void {
    if (!onProgress) {
      return
    }

    connection.onMessage((message) => {
      switch (message.type) {
        case "progress": {
          const formatted = this.formatter.formatProgress((message.data as { message: string }).message)
          onProgress(formatted)
          break
        }

        case "update": {
          const formatted = this.formatter.formatUpdate(message.data)
          if (formatted) {
            onProgress(formatted)
          }
          break
        }

        case "error": {
          const formatted = this.formatter.formatError(message.data as { message: string; stack?: string })
          onProgress(formatted)
          connection.close()
          break
        }

        case "complete": {
          connection.close()
          break
        }
      }
    })
  }

  private generateSessionId(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID()
    }

    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  }
}

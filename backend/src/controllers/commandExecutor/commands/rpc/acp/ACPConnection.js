import {spawn} from 'child_process'
import {Writable, Readable} from 'stream'
import {ClientSideConnection, ndJsonStream, PROTOCOL_VERSION} from '@agentclientprotocol/sdk'

export class ACPConnection {
  constructor({command, args = [], env = {}, timeoutMs = 300_000, cwd = process.cwd()}) {
    this.command = command
    this.args = args
    this.env = env
    this.timeoutMs = timeoutMs
    this.cwd = cwd

    this.process = null
    this.connection = null
    this.client = null
    this.sessionId = null
  }

  async initialize(client) {
    this.client = client

    this.process = spawn(this.command, this.args, {
      env: {...process.env, ...this.env},
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.cwd,
    })

    const input = Writable.toWeb(this.process.stdin)
    const output = Readable.toWeb(this.process.stdout)
    const stream = ndJsonStream(input, output)

    this.connection = new ClientSideConnection(() => this.client, stream)

    const initResponse = await this.connection.initialize({
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: {},
    })

    return initResponse
  }

  async createSession() {
    if (!this.connection) {
      throw new Error('Connection not initialized')
    }

    const response = await this.connection.newSession({
      cwd: this.cwd,
      mcpServers: [],
    })

    this.sessionId = response.sessionId
    return response.sessionId
  }

  async sendPrompt(prompt) {
    if (!this.connection || !this.sessionId) {
      throw new Error('Connection or session not initialized')
    }

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`ACP prompt timeout after ${this.timeoutMs}ms`)), this.timeoutMs)
    })

    const promptPromise = this.connection.prompt({
      sessionId: this.sessionId,
      prompt: [{type: 'text', text: prompt}],
    })

    const response = await Promise.race([promptPromise, timeoutPromise])
    return response
  }

  async cancel() {
    if (!this.connection || !this.sessionId) return

    try {
      await this.connection.cancel({sessionId: this.sessionId})
    } catch (error) {
      // Cancellation may fail if session already ended
    }
  }

  async close() {
    if (this.connection) {
      try {
        await Promise.race([this.connection.closed, new Promise(resolve => setTimeout(resolve, 1000))])
      } catch (error) {
        // Ignore close errors
      }
      this.connection = null
    }

    if (this.process) {
      this.process.kill('SIGTERM')

      await new Promise(resolve => {
        const forceKillTimeout = setTimeout(() => {
          if (!this.process.killed) {
            this.process.kill('SIGKILL')
          }
          resolve()
        }, 5000)

        this.process.on('exit', () => {
          clearTimeout(forceKillTimeout)
          resolve()
        })
      })

      this.process = null
    }
  }

  getSessionId() {
    return this.sessionId
  }
}

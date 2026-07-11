const {AgentSideConnection, ndJsonStream, PROTOCOL_VERSION} = require('@agentclientprotocol/sdk')
const {Writable, Readable} = require('stream')

class EchoAgent {
  constructor(connection) {
    this.connection = connection
    this.sessions = new Map()
  }

  async initialize(params) {
    const capabilities = {
      promptCapabilities: {},
      sessionCapabilities: {
        newSession: true,
        loadSession: true,
      },
    }
    const info = {
      name: 'echo-acp-stub',
      version: '1.0.0',
    }
    return {
      protocolVersion: PROTOCOL_VERSION,
      agentCapabilities: capabilities,
      agentInfo: info,
      serverCapabilities: capabilities,
      serverInfo: info,
    }
  }

  async newSession(params) {
    const sessionId = `echo-session-${Date.now()}-${Math.random().toString(36).slice(2)}`
    this.sessions.set(sessionId, {created: Date.now()})
    return {sessionId}
  }

  async loadSession(params) {
    if (!this.sessions.has(params.sessionId)) {
      throw new Error(`Session not found: ${params.sessionId}`)
    }
    return {sessionId: params.sessionId}
  }

  async prompt(params) {
    const {sessionId, prompt} = params

    if (!this.sessions.has(sessionId)) {
      throw new Error(`Session not found: ${sessionId}`)
    }
    const textParts = prompt
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('\n')

    await this.connection.sessionUpdate({
      sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: {
          type: 'text',
          text: `Echo: ${textParts}`,
        },
      },
    })

    return {
      stopReason: 'end_turn',
    }
  }
  async listSessions() {
    return {sessions: Array.from(this.sessions.keys()).map(id => ({sessionId: id}))}
  }

  async forkSession() {
    throw new Error('forkSession not implemented in echo stub')
  }

  async resumeSession() {
    throw new Error('resumeSession not implemented in echo stub')
  }

  async setSessionMode() {
    throw new Error('setSessionMode not implemented in echo stub')
  }

  async setSessionConfigOption() {
    throw new Error('setSessionConfigOption not implemented in echo stub')
  }

  async setSessionModel() {
    throw new Error('setSessionModel not implemented in echo stub')
  }

  async ext() {
    throw new Error('ext not implemented in echo stub')
  }

  async cancel() {
  }
}
const output = Writable.toWeb(process.stdout)
const input = Readable.toWeb(process.stdin)
const stream = ndJsonStream(output, input)
const connection = new AgentSideConnection(conn => new EchoAgent(conn), stream)
process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))

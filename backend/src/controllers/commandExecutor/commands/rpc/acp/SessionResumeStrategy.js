export class SessionResumeStrategy {
  constructor(connection, agentCapabilities) {
    this.connection = connection
    this.agentCapabilities = agentCapabilities
  }

  canResumeSession() {
    return this.agentCapabilities?.session?.resume === true
  }

  async resumeSession(sessionId, cwd) {
    if (!this.connection) {
      throw new Error('Connection not initialized')
    }

    if (!sessionId) {
      throw new Error('Session ID required for resume')
    }

    const response = await this.connection.unstable_resumeSession({
      sessionId,
      cwd: cwd ?? process.cwd(),
    })

    return response.sessionId
  }

  async createNewSession(cwd, mcpServers = []) {
    if (!this.connection) {
      throw new Error('Connection not initialized')
    }

    const response = await this.connection.newSession({
      cwd: cwd ?? process.cwd(),
      mcpServers: mcpServers ?? [],
    })

    return response.sessionId
  }

  async acquireSession(lastSessionId, cwd, mcpServers) {
    if (lastSessionId && this.canResumeSession()) {
      try {
        return await this.resumeSession(lastSessionId, cwd)
      } catch (error) {
        return await this.createNewSession(cwd, mcpServers)
      }
    }

    return await this.createNewSession(cwd, mcpServers)
  }
}

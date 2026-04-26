import StreamSession from './StreamSession'

class StreamBridge {
  constructor() {
    this.sessions = new Map()
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000)
  }

  createSession(sessionId) {
    if (this.sessions.has(sessionId)) {
      this.sessions.get(sessionId).close()
    }

    const session = new StreamSession(sessionId)
    this.sessions.set(sessionId, session)

    return session
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId)
  }

  hasSession(sessionId) {
    return this.sessions.has(sessionId)
  }

  emit(sessionId, event) {
    const session = this.sessions.get(sessionId)

    if (!session) {
      return false
    }

    return session.write(event)
  }

  closeSession(sessionId) {
    const session = this.sessions.get(sessionId)

    if (session) {
      session.close()
      this.sessions.delete(sessionId)
    }
  }

  cleanup() {
    const deadSessions = []

    for (const [id, session] of this.sessions.entries()) {
      if (!session.isAlive()) {
        deadSessions.push(id)
      }
    }

    deadSessions.forEach(id => this.closeSession(id))
  }

  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    for (const session of this.sessions.values()) {
      session.close()
    }

    this.sessions.clear()
  }
}

export default new StreamBridge()

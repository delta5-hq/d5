import debug from 'debug'
import StreamSession from './StreamSession'

const logWarn = debug('delta5:stream:warn')
const SESSION_STALE_MS = 5 * 60 * 1000

class StreamBridge {
  constructor() {
    this.sessions = new Map()
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000)
  }

  // writer (POST) and reader (GET) race — whichever arrives first wins; events buffer until replay
  getOrCreateSession(sessionId) {
    const existing = this.sessions.get(sessionId)
    if (existing?.isAlive()) return existing
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
      logWarn('emit: session %s not found — event dropped', sessionId)
      return false
    }
    return session.write(event)
  }

  attachReader(sessionId, lastEventId = null) {
    return this.getOrCreateSession(sessionId).getReadableStream(lastEventId)
  }

  closeSession(sessionId) {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.close()
      this.sessions.delete(sessionId)
    }
  }

  cleanup() {
    const now = Date.now()
    const staleIds = []
    for (const [id, session] of this.sessions) {
      if (!session.isAlive() || now - session.createdAt > SESSION_STALE_MS) {
        staleIds.push(id)
      }
    }
    for (const id of staleIds) {
      this.closeSession(id)
    }
  }

  shutdown() {
    clearInterval(this.cleanupInterval)
    for (const session of this.sessions.values()) {
      session.close()
    }
    this.sessions.clear()
  }
}

export default new StreamBridge()

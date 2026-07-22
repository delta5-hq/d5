import {PassThrough} from 'stream'

class StreamSession {
  constructor(sessionId) {
    this.id = sessionId
    this.stream = new PassThrough()
    this.active = true
    this.createdAt = Date.now()
  }

  write(event) {
    if (!this.active || !this.stream.writable) {
      return false
    }

    try {
      this.stream.write(event.toSSE())
      return true
    } catch (error) {
      this.close()
      return false
    }
  }

  close() {
    if (!this.active) {
      return
    }

    this.active = false
    this.stream.end()
  }

  getReadableStream() {
    return this.stream
  }

  isAlive() {
    return this.active && !this.stream.destroyed
  }
}

export default StreamSession

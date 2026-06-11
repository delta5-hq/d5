import {EventEmitter} from 'events'
import {PassThrough} from 'stream'

const REPLAY_BUFFER_CAPACITY = 100
const MAX_CONCURRENT_READERS = 50

class StreamSession {
  constructor(sessionId) {
    this.id = sessionId
    this.createdAt = Date.now()
    this.active = true
    this._nextEventId = 1
    this._replayBuffer = []
    this._emitter = new EventEmitter()
    this._emitter.setMaxListeners(MAX_CONCURRENT_READERS)
  }

  write(event) {
    if (!this.active) return false

    const eventId = this._nextEventId++
    const raw = event.toSSE(eventId)

    this._replayBuffer.push({id: eventId, raw})
    if (this._replayBuffer.length > REPLAY_BUFFER_CAPACITY) {
      this._replayBuffer.shift()
    }

    this._emitter.emit('event', raw)
    return true
  }

  close() {
    if (!this.active) return
    this.active = false
    this._emitter.emit('end')
    this._emitter.removeAllListeners()
  }

  // replay and subscribe run in the same event-loop turn — no events can be missed between them
  getReadableStream(fromEventId = null) {
    const stream = new PassThrough()

    const toReplay = fromEventId == null ? this._replayBuffer : this._replayBuffer.filter(e => e.id > fromEventId)

    for (const {raw} of toReplay) {
      stream.write(raw)
    }

    if (!this.active) {
      stream.end()
      return stream
    }

    const onEvent = raw => {
      if (!stream.destroyed) stream.write(raw)
    }
    const onEnd = () => stream.end()

    this._emitter.on('event', onEvent)
    this._emitter.once('end', onEnd)

    stream.on('close', () => {
      this._emitter.off('event', onEvent)
      this._emitter.off('end', onEnd)
    })

    return stream
  }

  isAlive() {
    return this.active
  }
}

export default StreamSession

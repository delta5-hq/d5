import StreamSession from './StreamSession'
import {StreamEvent} from './StreamEvent'

const collectStream = stream =>
  new Promise((resolve, reject) => {
    const chunks = []
    stream.on('data', chunk => chunks.push(chunk.toString()))
    stream.on('end', () => resolve(chunks.join('')))
    stream.on('error', reject)
  })

describe('StreamSession', () => {
  let session

  beforeEach(() => {
    session = new StreamSession('test-id')
  })

  afterEach(() => {
    session.close()
  })

  describe('constructor', () => {
    it('should initialise with the given id, active=true, and a creation timestamp', () => {
      const before = Date.now()
      const s = new StreamSession('s1')
      const after = Date.now()
      expect(s.id).toBe('s1')
      expect(s.active).toBe(true)
      expect(s.createdAt).toBeGreaterThanOrEqual(before)
      expect(s.createdAt).toBeLessThanOrEqual(after)
      s.close()
    })
  })

  describe('write', () => {
    it('should return true for an active session', () => {
      expect(session.write(StreamEvent.progress('x'))).toBe(true)
    })

    it('should return false after the session is closed', () => {
      session.close()
      expect(session.write(StreamEvent.progress('x'))).toBe(false)
    })

    it('should deliver written events to a connected reader', done => {
      const stream = session.getReadableStream()
      const chunks = []
      stream.on('data', c => chunks.push(c.toString()))

      session.write(StreamEvent.progress('hello'))
      session.close()

      stream.on('end', () => {
        expect(chunks.join('')).toContain('hello')
        done()
      })
    })

    it('should include a monotonically increasing id: line in each emitted event', async () => {
      session.write(StreamEvent.progress('first'))
      session.write(StreamEvent.progress('second'))
      session.write(StreamEvent.progress('third'))
      const stream = session.getReadableStream()
      session.close()
      const body = await collectStream(stream)

      expect(body).toContain('id: 1\n')
      expect(body).toContain('id: 2\n')
      expect(body).toContain('id: 3\n')
    })

    it('should keep the replay buffer at or below its capacity after many writes', () => {
      const capacity = 100
      for (let i = 0; i < capacity + 10; i++) {
        session.write(StreamEvent.progress(`msg-${i}`))
      }
      expect(session._replayBuffer.length).toBeLessThanOrEqual(capacity)
    })

    it('should drop the oldest buffered event when capacity is exceeded', () => {
      const capacity = 100
      for (let i = 1; i <= capacity + 1; i++) {
        session.write(StreamEvent.progress(`msg-${i}`))
      }
      const ids = session._replayBuffer.map(e => e.id)
      expect(ids[0]).toBe(2)
    })
  })

  describe('close', () => {
    it('should set active to false', () => {
      session.close()
      expect(session.active).toBe(false)
    })

    it('should be idempotent — multiple close calls do not throw', () => {
      expect(() => {
        session.close()
        session.close()
        session.close()
      }).not.toThrow()
      expect(session.active).toBe(false)
    })

    it('should end a connected reader stream', done => {
      const stream = session.getReadableStream()
      stream.resume()
      stream.on('end', done)
      session.close()
    })

    it('should end all simultaneously attached reader streams', done => {
      let ended = 0
      const onEnd = () => {
        if (++ended === 3) done()
      }
      const r1 = session.getReadableStream()
      r1.resume()
      r1.on('end', onEnd)
      const r2 = session.getReadableStream()
      r2.resume()
      r2.on('end', onEnd)
      const r3 = session.getReadableStream()
      r3.resume()
      r3.on('end', onEnd)
      session.close()
    })
  })

  describe('isAlive', () => {
    it('should return true for a new session', () => {
      expect(session.isAlive()).toBe(true)
    })

    it('should return false after close', () => {
      session.close()
      expect(session.isAlive()).toBe(false)
    })
  })

  describe('getReadableStream — initial connection (no fromEventId)', () => {
    it('should replay all buffered events written before the reader attached', async () => {
      session.write(StreamEvent.progress('a'))
      session.write(StreamEvent.progress('b'))
      session.write(StreamEvent.progress('c'))

      const stream = session.getReadableStream()
      session.close()
      const body = await collectStream(stream)

      expect(body).toContain('"message":"a"')
      expect(body).toContain('"message":"b"')
      expect(body).toContain('"message":"c"')
    })

    it('should deliver events written after the reader attached', done => {
      const stream = session.getReadableStream()
      const chunks = []
      stream.on('data', c => chunks.push(c.toString()))

      session.write(StreamEvent.progress('live'))
      session.close()

      stream.on('end', () => {
        expect(chunks.join('')).toContain('live')
        done()
      })
    })

    it('should deliver replayed and live events in FIFO order', async () => {
      session.write(StreamEvent.progress('buffered'))
      const stream = session.getReadableStream()
      session.write(StreamEvent.progress('live'))
      session.close()

      const body = await collectStream(stream)
      const bufPos = body.indexOf('"message":"buffered"')
      const livePos = body.indexOf('"message":"live"')
      expect(bufPos).toBeGreaterThanOrEqual(0)
      expect(livePos).toBeGreaterThan(bufPos)
    })

    it('should return an immediately-ended stream when the session is already closed', done => {
      session.close()
      const stream = session.getReadableStream()
      stream.resume()
      stream.on('end', done)
    })

    it('should return a distinct stream object on each call', () => {
      expect(session.getReadableStream()).not.toBe(session.getReadableStream())
    })

    it('should replay the full buffer even when many events were written before attaching', async () => {
      for (let i = 0; i < 20; i++) session.write(StreamEvent.progress(`msg-${i}`))
      const stream = session.getReadableStream()
      session.close()
      const body = await collectStream(stream)
      for (let i = 0; i < 20; i++) expect(body).toContain(`"message":"msg-${i}"`)
    })
  })

  describe('getReadableStream — reconnect (fromEventId provided)', () => {
    it('should skip events up to and including fromEventId', async () => {
      session.write(StreamEvent.progress('e1'))
      session.write(StreamEvent.progress('e2'))
      session.write(StreamEvent.progress('e3'))

      const stream = session.getReadableStream(2)
      session.close()
      const body = await collectStream(stream)

      expect(body).not.toContain('"message":"e1"')
      expect(body).not.toContain('"message":"e2"')
      expect(body).toContain('"message":"e3"')
    })

    it('should deliver no buffered events when fromEventId equals the latest emitted id', async () => {
      session.write(StreamEvent.progress('e1'))
      session.write(StreamEvent.progress('e2'))

      const stream = session.getReadableStream(2)
      session.close()
      const body = await collectStream(stream)

      expect(body).toBe('')
    })

    it('should replay all buffered events when fromEventId is below the oldest buffered id', async () => {
      session.write(StreamEvent.progress('e1'))
      session.write(StreamEvent.progress('e2'))

      const stream = session.getReadableStream(0)
      session.close()
      const body = await collectStream(stream)

      expect(body).toContain('"message":"e1"')
      expect(body).toContain('"message":"e2"')
    })

    it('should deliver only live events when fromEventId is above all buffered ids', done => {
      session.write(StreamEvent.progress('old'))
      const stream = session.getReadableStream(999)
      const chunks = []
      stream.on('data', c => chunks.push(c.toString()))
      session.write(StreamEvent.progress('new'))
      session.close()
      stream.on('end', () => {
        const body = chunks.join('')
        expect(body).not.toContain('"message":"old"')
        expect(body).toContain('"message":"new"')
        done()
      })
    })
  })

  describe('getReadableStream — event delivery ordering guarantee', () => {
    it('should deliver all events before the reader attached then all events after, in order', async () => {
      session.write(StreamEvent.progress('pre1'))
      session.write(StreamEvent.progress('pre2'))
      const stream = session.getReadableStream()
      session.write(StreamEvent.progress('post1'))
      session.write(StreamEvent.progress('post2'))
      session.close()

      const body = await collectStream(stream)
      const positions = ['pre1', 'pre2', 'post1', 'post2'].map(m => body.indexOf(`"message":"${m}"`))
      expect(positions[0]).toBeGreaterThanOrEqual(0)
      for (let i = 1; i < positions.length; i++) expect(positions[i]).toBeGreaterThan(positions[i - 1])
    })
  })

  describe('getReadableStream — multiple concurrent readers', () => {
    it('should deliver the same live events independently to each reader', done => {
      let settled = 0
      const check = body => {
        expect(body).toContain('"message":"shared"')
        if (++settled === 2) done()
      }
      const r1 = session.getReadableStream()
      const r2 = session.getReadableStream()
      collectStream(r1).then(check)
      collectStream(r2).then(check)
      session.write(StreamEvent.progress('shared'))
      session.close()
    })

    it('should clean up event listeners when a reader stream is destroyed', done => {
      const before = session._emitter.listenerCount('event')
      const stream = session.getReadableStream()
      stream.on('close', () => {
        const after = session._emitter.listenerCount('event')
        expect(after).toBe(before)
        done()
      })
      stream.destroy()
    })

    it('should not throw when writing after a reader stream has been destroyed', () => {
      const stream = session.getReadableStream()
      stream.destroy()
      expect(() => session.write(StreamEvent.progress('after-destroy'))).not.toThrow()
    })
  })
})

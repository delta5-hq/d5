import StreamSession from './StreamSession'
import {StreamEvent} from './StreamEvent'

describe('StreamSession', () => {
  let session

  beforeEach(() => {
    session = new StreamSession('test-session-id')
  })

  afterEach(() => {
    if (session && session.active) {
      session.close()
    }
  })

  describe('constructor', () => {
    it('should initialize with session ID', () => {
      expect(session.id).toBe('test-session-id')
      expect(session.active).toBe(true)
      expect(session.createdAt).toBeGreaterThan(0)
    })

    it('should create unique session IDs', () => {
      const session1 = new StreamSession('id-1')
      const session2 = new StreamSession('id-2')

      expect(session1.id).not.toBe(session2.id)

      session1.close()
      session2.close()
    })

    it('should create PassThrough stream', () => {
      expect(session.stream).toBeDefined()
      expect(session.stream.readable).toBe(true)
      expect(session.stream.writable).toBe(true)
    })

    it('should set createdAt timestamp at construction time', () => {
      const before = Date.now()
      const newSession = new StreamSession('test')
      const after = Date.now()

      expect(newSession.createdAt).toBeGreaterThanOrEqual(before)
      expect(newSession.createdAt).toBeLessThanOrEqual(after)

      newSession.close()
    })
  })

  describe('write', () => {
    it('should write event to stream', () => {
      const event = StreamEvent.progress('test')
      const result = session.write(event)

      expect(result).toBe(true)
      expect(session.stream.readableLength).toBeGreaterThan(0)
    })

    it('should return false when session is closed', () => {
      session.close()
      const event = StreamEvent.progress('test')
      const result = session.write(event)

      expect(result).toBe(false)
    })

    it('should return false for destroyed stream', () => {
      session.stream.end()
      session.stream.destroy()
      const event = StreamEvent.progress('test')
      const result = session.write(event)

      expect(result).toBe(false)
    })

    it('should handle multiple consecutive writes', () => {
      const results = []

      for (let i = 0; i < 10; i++) {
        results.push(session.write(StreamEvent.progress(`message ${i}`)))
      }

      expect(results.every(r => r === true)).toBe(true)
    })

    it('should accumulate data in stream buffer', () => {
      session.write(StreamEvent.progress('message 1'))
      session.write(StreamEvent.progress('message 2'))
      session.write(StreamEvent.progress('message 3'))

      expect(session.stream.readableLength).toBeGreaterThan(0)
    })

    it('should call toSSE on the event', () => {
      const event = StreamEvent.progress('test')
      const toSSESpy = jest.spyOn(event, 'toSSE')

      session.write(event)

      expect(toSSESpy).toHaveBeenCalled()
    })

    it('should close session on write error', () => {
      jest.spyOn(session.stream, 'write').mockImplementation(() => {
        throw new Error('Write failed')
      })

      const result = session.write(StreamEvent.progress('test'))

      expect(result).toBe(false)
      expect(session.active).toBe(false)
    })

    it('should check both active and writable state', () => {
      session.active = false
      session.stream.writable = false

      const result = session.write(StreamEvent.progress('test'))

      expect(result).toBe(false)
    })
  })

  describe('close', () => {
    it('should mark session as inactive', () => {
      session.close()

      expect(session.active).toBe(false)
    })

    it('should end the stream', () => {
      const endSpy = jest.spyOn(session.stream, 'end')

      session.close()

      expect(endSpy).toHaveBeenCalled()
    })

    it('should be idempotent', () => {
      session.close()
      session.close()
      session.close()

      expect(session.active).toBe(false)
    })

    it('should not throw when called multiple times', () => {
      expect(() => {
        session.close()
        session.close()
        session.close()
      }).not.toThrow()
    })

    it('should prevent further writes after close', () => {
      session.close()

      const result = session.write(StreamEvent.progress('test'))

      expect(result).toBe(false)
    })

    it('should not call end again if already inactive', () => {
      session.close()
      const endSpy = jest.spyOn(session.stream, 'end')

      session.close()

      expect(endSpy).not.toHaveBeenCalled()
    })
  })

  describe('isAlive', () => {
    it('should return true for active session with valid stream', () => {
      expect(session.isAlive()).toBe(true)
    })

    it('should return false for closed session', () => {
      session.close()

      expect(session.isAlive()).toBe(false)
    })

    it('should return false for destroyed stream even if active flag is true', () => {
      session.stream.destroy()

      expect(session.isAlive()).toBe(false)
    })

    it('should return false when active is false', () => {
      session.active = false

      expect(session.isAlive()).toBe(false)
    })

    it('should check both active flag and stream state', () => {
      expect(session.active).toBe(true)
      expect(session.stream.destroyed).toBe(false)
      expect(session.isAlive()).toBe(true)

      session.active = false
      expect(session.isAlive()).toBe(false)

      session.active = true
      session.stream.destroy()
      expect(session.isAlive()).toBe(false)
    })
  })

  describe('getReadableStream', () => {
    it('should return the underlying stream', () => {
      const stream = session.getReadableStream()

      expect(stream).toBe(session.stream)
    })

    it('should return same stream on multiple calls', () => {
      const stream1 = session.getReadableStream()
      const stream2 = session.getReadableStream()

      expect(stream1).toBe(stream2)
    })

    it('should return readable stream that can be piped', done => {
      const chunks = []

      session.getReadableStream().on('data', chunk => {
        chunks.push(chunk.toString())
      })

      session.getReadableStream().on('end', () => {
        expect(chunks.length).toBeGreaterThan(0)
        done()
      })

      session.write(StreamEvent.progress('test'))
      session.close()
    })
  })

  describe('lifecycle integration', () => {
    it('should handle full lifecycle: create -> write -> read -> close', done => {
      const events = [
        StreamEvent.progress('Starting'),
        StreamEvent.update({status: 'running'}),
        StreamEvent.progress('Processing'),
        StreamEvent.complete({result: 'done'}),
      ]

      const chunks = []

      session.stream.on('data', chunk => {
        chunks.push(chunk.toString())
      })

      session.stream.on('end', () => {
        expect(chunks.length).toBe(4)
        expect(session.active).toBe(false)
        done()
      })

      events.forEach(event => session.write(event))
      session.close()
    })

    it('should maintain FIFO order of events', done => {
      const messages = []

      session.stream.on('data', chunk => {
        const data = JSON.parse(chunk.toString().replace('data: ', '').trim())
        if (data.type === 'progress') {
          messages.push(data.data.message)
        }
      })

      session.stream.on('end', () => {
        expect(messages).toEqual(['first', 'second', 'third'])
        done()
      })

      session.write(StreamEvent.progress('first'))
      session.write(StreamEvent.progress('second'))
      session.write(StreamEvent.progress('third'))
      session.close()
    })
  })
})

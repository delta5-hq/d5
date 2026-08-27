import StreamBridge from './StreamBridge'
import {StreamEvent} from './StreamEvent'

afterEach(() => {
  for (const [id] of StreamBridge.sessions) {
    StreamBridge.closeSession(id)
  }
  jest.restoreAllMocks()
})

describe('getOrCreateSession', () => {
  it('should create a new session when none exists for the given id', () => {
    const s = StreamBridge.getOrCreateSession('s1')
    expect(s).toBeDefined()
    expect(s.id).toBe('s1')
    expect(StreamBridge.hasSession('s1')).toBe(true)
  })

  it('should return the same session on repeated calls — idempotent', () => {
    const a = StreamBridge.getOrCreateSession('s1')
    const b = StreamBridge.getOrCreateSession('s1')
    expect(a).toBe(b)
  })

  it('should create a fresh session when the existing one is no longer alive', () => {
    const a = StreamBridge.getOrCreateSession('s1')
    a.close()
    const b = StreamBridge.getOrCreateSession('s1')
    expect(b).not.toBe(a)
    expect(b.isAlive()).toBe(true)
  })

  it('should support any number of concurrent sessions with distinct ids', () => {
    StreamBridge.getOrCreateSession('a')
    StreamBridge.getOrCreateSession('b')
    StreamBridge.getOrCreateSession('c')
    expect(StreamBridge.hasSession('a')).toBe(true)
    expect(StreamBridge.hasSession('b')).toBe(true)
    expect(StreamBridge.hasSession('c')).toBe(true)
  })
})

describe('getSession', () => {
  it('should return the session object for a known id', () => {
    const s = StreamBridge.getOrCreateSession('s1')
    expect(StreamBridge.getSession('s1')).toBe(s)
  })

  it('should return undefined for an unknown id', () => {
    expect(StreamBridge.getSession('missing')).toBeUndefined()
  })
})

describe('hasSession', () => {
  it('should return true for an existing session', () => {
    StreamBridge.getOrCreateSession('s1')
    expect(StreamBridge.hasSession('s1')).toBe(true)
  })

  it('should return false for an unknown id', () => {
    expect(StreamBridge.hasSession('nope')).toBe(false)
  })

  it('should return false after the session is closed via closeSession', () => {
    StreamBridge.getOrCreateSession('s1')
    StreamBridge.closeSession('s1')
    expect(StreamBridge.hasSession('s1')).toBe(false)
  })
})

describe('emit', () => {
  it('should write the event to the session and return true', () => {
    const s = StreamBridge.getOrCreateSession('s1')
    const writeSpy = jest.spyOn(s, 'write').mockReturnValue(true)
    expect(StreamBridge.emit('s1', StreamEvent.progress('x'))).toBe(true)
    expect(writeSpy).toHaveBeenCalled()
  })

  it('should return false for an unknown session id', () => {
    const result = StreamBridge.emit('ghost', StreamEvent.progress('x'))
    expect(result).toBe(false)
  })

  it('should return false when the session was removed by closeSession', () => {
    StreamBridge.getOrCreateSession('s1')
    StreamBridge.closeSession('s1')
    expect(StreamBridge.emit('s1', StreamEvent.progress('x'))).toBe(false)
  })

  it('should return false when the session is in the map but has been closed directly', () => {
    const s = StreamBridge.getOrCreateSession('s1')
    s.close()
    expect(StreamBridge.emit('s1', StreamEvent.progress('x'))).toBe(false)
  })

  it('should deliver events to a reader attached to the session', done => {
    StreamBridge.getOrCreateSession('s1')
    const stream = StreamBridge.attachReader('s1')
    const chunks = []
    stream.on('data', c => chunks.push(c.toString()))

    StreamBridge.emit('s1', StreamEvent.progress('hello'))
    StreamBridge.closeSession('s1')

    stream.on('end', () => {
      expect(chunks.join('')).toContain('hello')
      done()
    })
  })
})

describe('attachReader', () => {
  it('should return a readable stream for an existing session', () => {
    StreamBridge.getOrCreateSession('s1')
    const stream = StreamBridge.attachReader('s1')
    expect(typeof stream.pipe).toBe('function')
    StreamBridge.closeSession('s1')
  })

  it('should create the session when no writer has reserved it yet (GET-before-POST)', done => {
    const stream = StreamBridge.attachReader('new-session')
    const chunks = []
    stream.on('data', c => chunks.push(c.toString()))

    StreamBridge.emit('new-session', StreamEvent.progress('written-after-attach'))
    StreamBridge.closeSession('new-session')

    stream.on('end', () => {
      expect(chunks.join('')).toContain('written-after-attach')
      done()
    })
  })

  it('should replay events buffered before the reader attached (POST-before-GET)', done => {
    StreamBridge.getOrCreateSession('s1')
    StreamBridge.emit('s1', StreamEvent.progress('pre-attach'))

    const stream = StreamBridge.attachReader('s1')
    const chunks = []
    stream.on('data', c => chunks.push(c.toString()))
    StreamBridge.closeSession('s1')

    stream.on('end', () => {
      expect(chunks.join('')).toContain('pre-attach')
      done()
    })
  })

  it('should replay only events emitted after lastEventId on reconnect', done => {
    StreamBridge.getOrCreateSession('s1')
    StreamBridge.emit('s1', StreamEvent.progress('e1'))
    StreamBridge.emit('s1', StreamEvent.progress('e2'))
    StreamBridge.emit('s1', StreamEvent.progress('e3'))

    const stream = StreamBridge.attachReader('s1', 2)
    const chunks = []
    stream.on('data', c => chunks.push(c.toString()))
    StreamBridge.closeSession('s1')

    stream.on('end', () => {
      const body = chunks.join('')
      expect(body).not.toContain('"message":"e1"')
      expect(body).not.toContain('"message":"e2"')
      expect(body).toContain('"message":"e3"')
      done()
    })
  })

  it('should treat lastEventId 0 as a valid replay point and replay all subsequent events', done => {
    StreamBridge.getOrCreateSession('s1')
    StreamBridge.emit('s1', StreamEvent.progress('e1'))
    StreamBridge.emit('s1', StreamEvent.progress('e2'))

    const stream = StreamBridge.attachReader('s1', 0)
    const chunks = []
    stream.on('data', c => chunks.push(c.toString()))
    StreamBridge.closeSession('s1')

    stream.on('end', () => {
      const body = chunks.join('')
      expect(body).toContain('"message":"e1"')
      expect(body).toContain('"message":"e2"')
      done()
    })
  })
})

describe('closeSession', () => {
  it('should remove the session from the registry', () => {
    StreamBridge.getOrCreateSession('s1')
    StreamBridge.closeSession('s1')
    expect(StreamBridge.hasSession('s1')).toBe(false)
  })

  it('should be a no-op for an unknown id', () => {
    expect(() => StreamBridge.closeSession('ghost')).not.toThrow()
  })
})

describe('cleanup', () => {
  it('should remove sessions that are no longer alive', () => {
    const s = StreamBridge.getOrCreateSession('s1')
    s.close()
    StreamBridge.cleanup()
    expect(StreamBridge.hasSession('s1')).toBe(false)
  })

  it('should remove sessions that exceed the stale threshold', () => {
    const s = StreamBridge.getOrCreateSession('s1')
    s.createdAt = Date.now() - 6 * 60 * 1000
    StreamBridge.cleanup()
    expect(StreamBridge.hasSession('s1')).toBe(false)
  })

  it('should keep sessions that are alive and within the stale threshold', () => {
    StreamBridge.getOrCreateSession('s1')
    StreamBridge.cleanup()
    expect(StreamBridge.hasSession('s1')).toBe(true)
  })

  it('should not throw when no sessions are registered', () => {
    expect(() => StreamBridge.cleanup()).not.toThrow()
  })
})

describe('shutdown', () => {
  it('should close all sessions and clear the registry', () => {
    StreamBridge.getOrCreateSession('x1')
    StreamBridge.getOrCreateSession('x2')
    StreamBridge.shutdown()
    expect(StreamBridge.sessions.size).toBe(0)
  })

  it('should be callable when no sessions exist', () => {
    expect(() => StreamBridge.shutdown()).not.toThrow()
  })
})

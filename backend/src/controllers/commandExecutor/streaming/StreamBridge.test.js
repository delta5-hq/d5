import StreamBridge from './StreamBridge'
import {StreamEvent} from './StreamEvent'

describe('StreamBridge', () => {
  afterEach(() => {
    for (const [id] of StreamBridge.sessions) {
      StreamBridge.closeSession(id)
    }
  })

  describe('createSession', () => {
    it('should create new session with ID', () => {
      const session = StreamBridge.createSession('test-1')

      expect(session).toBeDefined()
      expect(session.id).toBe('test-1')
      expect(StreamBridge.hasSession('test-1')).toBe(true)
    })

    it('should close existing session with same ID before creating new one', () => {
      const session1 = StreamBridge.createSession('test-1')
      const closeSpy = jest.spyOn(session1, 'close')

      const session2 = StreamBridge.createSession('test-1')

      expect(closeSpy).toHaveBeenCalled()
      expect(session1.active).toBe(false)
      expect(session2.active).toBe(true)
      expect(StreamBridge.getSession('test-1')).toBe(session2)
    })

    it('should support multiple concurrent sessions with different IDs', () => {
      const session1 = StreamBridge.createSession('id-1')
      const session2 = StreamBridge.createSession('id-2')
      const session3 = StreamBridge.createSession('id-3')

      expect(StreamBridge.hasSession('id-1')).toBe(true)
      expect(StreamBridge.hasSession('id-2')).toBe(true)
      expect(StreamBridge.hasSession('id-3')).toBe(true)
      expect(session1).not.toBe(session2)
      expect(session2).not.toBe(session3)
    })

    it('should handle rapid session creation with same ID', () => {
      for (let i = 0; i < 10; i++) {
        StreamBridge.createSession('rapid-test')
      }

      expect(StreamBridge.hasSession('rapid-test')).toBe(true)
      expect(StreamBridge.sessions.size).toBe(1)
    })
  })

  describe('getSession', () => {
    it('should return session by ID', () => {
      const session = StreamBridge.createSession('test-1')
      const retrieved = StreamBridge.getSession('test-1')

      expect(retrieved).toBe(session)
    })

    it('should return undefined for non-existent session', () => {
      const retrieved = StreamBridge.getSession('non-existent')

      expect(retrieved).toBeUndefined()
    })

    it('should return different sessions for different IDs', () => {
      const session1 = StreamBridge.createSession('id-1')
      const session2 = StreamBridge.createSession('id-2')

      expect(StreamBridge.getSession('id-1')).toBe(session1)
      expect(StreamBridge.getSession('id-2')).toBe(session2)
      expect(StreamBridge.getSession('id-1')).not.toBe(session2)
    })
  })

  describe('hasSession', () => {
    it('should return true for existing session', () => {
      StreamBridge.createSession('test-1')

      expect(StreamBridge.hasSession('test-1')).toBe(true)
    })

    it('should return false for non-existent session', () => {
      expect(StreamBridge.hasSession('non-existent')).toBe(false)
    })

    it('should return false after session is closed', () => {
      StreamBridge.createSession('test-1')
      StreamBridge.closeSession('test-1')

      expect(StreamBridge.hasSession('test-1')).toBe(false)
    })

    it('should handle empty string session ID', () => {
      StreamBridge.createSession('')

      expect(StreamBridge.hasSession('')).toBe(true)
    })
  })

  describe('emit', () => {
    it('should emit event to existing session', () => {
      const session = StreamBridge.createSession('test-1')
      const writeSpy = jest.spyOn(session, 'write')
      const event = StreamEvent.progress('test')

      const result = StreamBridge.emit('test-1', event)

      expect(result).toBe(true)
      expect(writeSpy).toHaveBeenCalledWith(event)
    })

    it('should return false for non-existent session', () => {
      const event = StreamEvent.progress('test')
      const result = StreamBridge.emit('non-existent', event)

      expect(result).toBe(false)
    })

    it('should return false for closed session', () => {
      StreamBridge.createSession('test-1')
      StreamBridge.closeSession('test-1')

      const event = StreamEvent.progress('test')
      const result = StreamBridge.emit('test-1', event)

      expect(result).toBe(false)
    })

    it('should return result from session write', () => {
      const session = StreamBridge.createSession('test-1')
      jest.spyOn(session, 'write').mockReturnValue(false)

      const result = StreamBridge.emit('test-1', StreamEvent.progress('test'))

      expect(result).toBe(false)
    })

    it('should handle multiple events to same session', () => {
      StreamBridge.createSession('test-1')
      const events = [StreamEvent.progress('event1'), StreamEvent.update({data: 1}), StreamEvent.progress('event2')]

      const results = events.map(e => StreamBridge.emit('test-1', e))

      expect(results.every(r => r === true)).toBe(true)
    })

    it('should isolate events between sessions', () => {
      const session1 = StreamBridge.createSession('id-1')
      const session2 = StreamBridge.createSession('id-2')
      const spy1 = jest.spyOn(session1, 'write')
      const spy2 = jest.spyOn(session2, 'write')

      StreamBridge.emit('id-1', StreamEvent.progress('to session 1'))

      expect(spy1).toHaveBeenCalled()
      expect(spy2).not.toHaveBeenCalled()
    })
  })

  describe('closeSession', () => {
    it('should close and remove session', () => {
      const session = StreamBridge.createSession('test-1')
      const closeSpy = jest.spyOn(session, 'close')

      StreamBridge.closeSession('test-1')

      expect(closeSpy).toHaveBeenCalled()
      expect(session.active).toBe(false)
      expect(StreamBridge.hasSession('test-1')).toBe(false)
    })

    it('should be safe to call on non-existent session', () => {
      expect(() => {
        StreamBridge.closeSession('non-existent')
      }).not.toThrow()
    })

    it('should be idempotent', () => {
      StreamBridge.createSession('test-1')

      StreamBridge.closeSession('test-1')
      StreamBridge.closeSession('test-1')
      StreamBridge.closeSession('test-1')

      expect(StreamBridge.hasSession('test-1')).toBe(false)
    })

    it('should only close specified session', () => {
      StreamBridge.createSession('id-1')
      StreamBridge.createSession('id-2')

      StreamBridge.closeSession('id-1')

      expect(StreamBridge.hasSession('id-1')).toBe(false)
      expect(StreamBridge.hasSession('id-2')).toBe(true)
    })
  })

  describe('cleanup', () => {
    it('should remove dead sessions', () => {
      const session1 = StreamBridge.createSession('test-1')
      const session2 = StreamBridge.createSession('test-2')

      session1.close()

      StreamBridge.cleanup()

      expect(StreamBridge.hasSession('test-1')).toBe(false)
      expect(StreamBridge.hasSession('test-2')).toBe(true)
      expect(session2.active).toBe(true)
    })

    it('should handle destroyed streams', () => {
      const session = StreamBridge.createSession('test-1')
      session.stream.destroy()

      StreamBridge.cleanup()

      expect(StreamBridge.hasSession('test-1')).toBe(false)
    })

    it('should not affect alive sessions', () => {
      const session1 = StreamBridge.createSession('alive-1')
      const session2 = StreamBridge.createSession('alive-2')

      StreamBridge.cleanup()

      expect(StreamBridge.hasSession('alive-1')).toBe(true)
      expect(StreamBridge.hasSession('alive-2')).toBe(true)
      expect(session1.active).toBe(true)
      expect(session2.active).toBe(true)
    })

    it('should handle mixed alive and dead sessions', () => {
      StreamBridge.createSession('alive-1')
      const dead1 = StreamBridge.createSession('dead-1')
      StreamBridge.createSession('alive-2')
      const dead2 = StreamBridge.createSession('dead-2')

      dead1.close()
      dead2.stream.destroy()

      StreamBridge.cleanup()

      expect(StreamBridge.hasSession('alive-1')).toBe(true)
      expect(StreamBridge.hasSession('dead-1')).toBe(false)
      expect(StreamBridge.hasSession('alive-2')).toBe(true)
      expect(StreamBridge.hasSession('dead-2')).toBe(false)
    })

    it('should not throw on empty session map', () => {
      expect(() => {
        StreamBridge.cleanup()
      }).not.toThrow()
    })
  })

  describe('shutdown', () => {
    it('should close all active sessions', () => {
      const session1 = StreamBridge.createSession('id-1')
      const session2 = StreamBridge.createSession('id-2')
      const spy1 = jest.spyOn(session1, 'close')
      const spy2 = jest.spyOn(session2, 'close')

      StreamBridge.shutdown()

      expect(spy1).toHaveBeenCalled()
      expect(spy2).toHaveBeenCalled()
    })

    it('should clear cleanup interval', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')
      const interval = StreamBridge.cleanupInterval

      StreamBridge.shutdown()

      expect(clearIntervalSpy).toHaveBeenCalledWith(interval)
    })

    it('should clear all sessions from map', () => {
      StreamBridge.createSession('id-1')
      StreamBridge.createSession('id-2')
      StreamBridge.createSession('id-3')

      StreamBridge.shutdown()

      expect(StreamBridge.sessions.size).toBe(0)
    })

    it('should be safe to call multiple times', () => {
      expect(() => {
        StreamBridge.shutdown()
        StreamBridge.shutdown()
      }).not.toThrow()
    })
  })

  describe('singleton behavior', () => {
    it('should maintain state across imports', () => {
      const session = StreamBridge.createSession('singleton-test')

      expect(StreamBridge.hasSession('singleton-test')).toBe(true)
      expect(StreamBridge.getSession('singleton-test')).toBe(session)
    })

    it('should share session map across operations', () => {
      StreamBridge.createSession('shared-1')
      StreamBridge.createSession('shared-2')

      expect(StreamBridge.sessions.size).toBe(2)

      StreamBridge.closeSession('shared-1')

      expect(StreamBridge.sessions.size).toBe(1)
    })
  })

  describe('edge cases', () => {
    it('should handle rapid session create/close cycles', () => {
      for (let i = 0; i < 100; i++) {
        StreamBridge.createSession('rapid')
        StreamBridge.closeSession('rapid')
      }

      expect(StreamBridge.hasSession('rapid')).toBe(false)
    })

    it('should handle session IDs with special characters', () => {
      const specialIds = ['test-123', 'test_456', 'test.789', 'test@abc', 'test:xyz']

      specialIds.forEach(id => {
        StreamBridge.createSession(id)
        expect(StreamBridge.hasSession(id)).toBe(true)
        StreamBridge.closeSession(id)
      })
    })

    it('should handle very long session IDs', () => {
      const longId = 'x'.repeat(1000)

      StreamBridge.createSession(longId)

      expect(StreamBridge.hasSession(longId)).toBe(true)
    })
  })
})

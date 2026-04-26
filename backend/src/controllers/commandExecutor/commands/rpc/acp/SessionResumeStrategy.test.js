import {SessionResumeStrategy} from './SessionResumeStrategy'

describe('SessionResumeStrategy', () => {
  let mockConnection
  let strategy

  beforeEach(() => {
    mockConnection = {
      unstable_resumeSession: jest.fn(),
      newSession: jest.fn(),
    }
  })

  describe('constructor', () => {
    it('stores connection and capabilities', () => {
      const capabilities = {session: {resume: true}}
      strategy = new SessionResumeStrategy(mockConnection, capabilities)

      expect(strategy.connection).toBe(mockConnection)
      expect(strategy.agentCapabilities).toBe(capabilities)
    })

    it('handles null capabilities gracefully', () => {
      strategy = new SessionResumeStrategy(mockConnection, null)

      expect(strategy.connection).toBe(mockConnection)
      expect(strategy.agentCapabilities).toBeNull()
    })
  })

  describe('canResumeSession', () => {
    it('returns true when agent advertises session.resume capability', () => {
      const capabilities = {session: {resume: true}}
      strategy = new SessionResumeStrategy(mockConnection, capabilities)

      expect(strategy.canResumeSession()).toBe(true)
    })

    it('returns false when session.resume capability is false', () => {
      const capabilities = {session: {resume: false}}
      strategy = new SessionResumeStrategy(mockConnection, capabilities)

      expect(strategy.canResumeSession()).toBe(false)
    })

    it('returns false when session capability is missing', () => {
      const capabilities = {}
      strategy = new SessionResumeStrategy(mockConnection, capabilities)

      expect(strategy.canResumeSession()).toBe(false)
    })

    it('returns false when capabilities are undefined', () => {
      strategy = new SessionResumeStrategy(mockConnection, undefined)

      expect(strategy.canResumeSession()).toBe(false)
    })

    it('returns false when capabilities are null', () => {
      strategy = new SessionResumeStrategy(mockConnection, null)

      expect(strategy.canResumeSession()).toBe(false)
    })

    it('returns false when session exists but resume is undefined', () => {
      const capabilities = {session: {fork: true}}
      strategy = new SessionResumeStrategy(mockConnection, capabilities)

      expect(strategy.canResumeSession()).toBe(false)
    })

    it('returns false when session.resume is not boolean true', () => {
      const testCases = [0, 1, 'true', {}, [], null]

      testCases.forEach(value => {
        const capabilities = {session: {resume: value}}
        strategy = new SessionResumeStrategy(mockConnection, capabilities)
        expect(strategy.canResumeSession()).toBe(false)
      })
    })
  })

  describe('resumeSession', () => {
    beforeEach(() => {
      strategy = new SessionResumeStrategy(mockConnection, {session: {resume: true}})
    })

    it('throws when connection is null', async () => {
      strategy.connection = null

      await expect(strategy.resumeSession('session-1', '/workspace')).rejects.toThrow('Connection not initialized')
    })

    it('throws when sessionId is missing', async () => {
      await expect(strategy.resumeSession(null, '/workspace')).rejects.toThrow('Session ID required for resume')
    })

    it('calls unstable_resumeSession with correct parameters', async () => {
      mockConnection.unstable_resumeSession.mockResolvedValue({sessionId: 'resumed-session'})

      const result = await strategy.resumeSession('session-1', '/workspace')

      expect(mockConnection.unstable_resumeSession).toHaveBeenCalledWith({
        sessionId: 'session-1',
        cwd: '/workspace',
      })
      expect(result).toBe('resumed-session')
    })

    it('uses process.cwd() when cwd is not provided', async () => {
      mockConnection.unstable_resumeSession.mockResolvedValue({sessionId: 'resumed-session'})

      await strategy.resumeSession('session-1')

      expect(mockConnection.unstable_resumeSession).toHaveBeenCalledWith({
        sessionId: 'session-1',
        cwd: process.cwd(),
      })
    })
  })

  describe('createNewSession', () => {
    beforeEach(() => {
      strategy = new SessionResumeStrategy(mockConnection, {})
    })

    it('throws when connection is null', async () => {
      strategy.connection = null

      await expect(strategy.createNewSession('/workspace')).rejects.toThrow('Connection not initialized')
    })

    it('calls newSession with correct parameters', async () => {
      mockConnection.newSession.mockResolvedValue({sessionId: 'new-session'})

      const result = await strategy.createNewSession('/workspace', [{name: 'mcp-server'}])

      expect(mockConnection.newSession).toHaveBeenCalledWith({
        cwd: '/workspace',
        mcpServers: [{name: 'mcp-server'}],
      })
      expect(result).toBe('new-session')
    })

    it('uses empty array for mcpServers when not provided', async () => {
      mockConnection.newSession.mockResolvedValue({sessionId: 'new-session'})

      await strategy.createNewSession('/workspace')

      expect(mockConnection.newSession).toHaveBeenCalledWith({
        cwd: '/workspace',
        mcpServers: [],
      })
    })

    it('uses process.cwd() when cwd is not provided', async () => {
      mockConnection.newSession.mockResolvedValue({sessionId: 'new-session'})

      await strategy.createNewSession()

      expect(mockConnection.newSession).toHaveBeenCalledWith({
        cwd: process.cwd(),
        mcpServers: [],
      })
    })
  })

  describe('acquireSession', () => {
    describe('when agent supports resume', () => {
      beforeEach(() => {
        strategy = new SessionResumeStrategy(mockConnection, {session: {resume: true}})
      })

      it('resumes existing session when lastSessionId provided and resume succeeds', async () => {
        mockConnection.unstable_resumeSession.mockResolvedValue({sessionId: 'resumed-session'})

        const result = await strategy.acquireSession('session-1', '/workspace', [])

        expect(mockConnection.unstable_resumeSession).toHaveBeenCalledWith({
          sessionId: 'session-1',
          cwd: '/workspace',
        })
        expect(mockConnection.newSession).not.toHaveBeenCalled()
        expect(result).toBe('resumed-session')
      })

      it('falls back to new session when resume fails', async () => {
        mockConnection.unstable_resumeSession.mockRejectedValue(new Error('Session not found'))
        mockConnection.newSession.mockResolvedValue({sessionId: 'new-session'})

        const result = await strategy.acquireSession('session-1', '/workspace', [])

        expect(mockConnection.unstable_resumeSession).toHaveBeenCalled()
        expect(mockConnection.newSession).toHaveBeenCalledWith({
          cwd: '/workspace',
          mcpServers: [],
        })
        expect(result).toBe('new-session')
      })

      it('creates new session when lastSessionId is null', async () => {
        mockConnection.newSession.mockResolvedValue({sessionId: 'new-session'})

        const result = await strategy.acquireSession(null, '/workspace', [])

        expect(mockConnection.unstable_resumeSession).not.toHaveBeenCalled()
        expect(mockConnection.newSession).toHaveBeenCalled()
        expect(result).toBe('new-session')
      })
    })

    describe('when agent does not support resume', () => {
      beforeEach(() => {
        strategy = new SessionResumeStrategy(mockConnection, {session: {resume: false}})
      })

      it('creates new session even when lastSessionId provided', async () => {
        mockConnection.newSession.mockResolvedValue({sessionId: 'new-session'})

        const result = await strategy.acquireSession('session-1', '/workspace', [])

        expect(mockConnection.unstable_resumeSession).not.toHaveBeenCalled()
        expect(mockConnection.newSession).toHaveBeenCalled()
        expect(result).toBe('new-session')
      })
    })

    it('passes mcpServers to createNewSession', async () => {
      strategy = new SessionResumeStrategy(mockConnection, {})
      mockConnection.newSession.mockResolvedValue({sessionId: 'new-session'})

      await strategy.acquireSession(null, '/workspace', [{name: 'server-1'}])

      expect(mockConnection.newSession).toHaveBeenCalledWith({
        cwd: '/workspace',
        mcpServers: [{name: 'server-1'}],
      })
    })
  })

  describe('edge cases', () => {
    describe('resumeSession parameter validation', () => {
      beforeEach(() => {
        strategy = new SessionResumeStrategy(mockConnection, {session: {resume: true}})
      })

      it('throws when sessionId is empty string', async () => {
        await expect(strategy.resumeSession('', '/workspace')).rejects.toThrow('Session ID required for resume')
      })

      it('throws when sessionId is undefined', async () => {
        await expect(strategy.resumeSession(undefined, '/workspace')).rejects.toThrow('Session ID required for resume')
      })

      it('handles cwd as empty string', async () => {
        mockConnection.unstable_resumeSession.mockResolvedValue({sessionId: 'resumed'})

        await strategy.resumeSession('session-1', '')

        expect(mockConnection.unstable_resumeSession).toHaveBeenCalledWith({
          sessionId: 'session-1',
          cwd: '',
        })
      })

      it('handles cwd as null by using process.cwd()', async () => {
        mockConnection.unstable_resumeSession.mockResolvedValue({sessionId: 'resumed'})

        await strategy.resumeSession('session-1', null)

        expect(mockConnection.unstable_resumeSession).toHaveBeenCalledWith({
          sessionId: 'session-1',
          cwd: process.cwd(),
        })
      })
    })

    describe('createNewSession parameter validation', () => {
      beforeEach(() => {
        strategy = new SessionResumeStrategy(mockConnection, {})
      })

      it('handles cwd as empty string', async () => {
        mockConnection.newSession.mockResolvedValue({sessionId: 'new'})

        await strategy.createNewSession('', [])

        expect(mockConnection.newSession).toHaveBeenCalledWith({
          cwd: '',
          mcpServers: [],
        })
      })

      it('handles cwd as null by using process.cwd()', async () => {
        mockConnection.newSession.mockResolvedValue({sessionId: 'new'})

        await strategy.createNewSession(null, [])

        expect(mockConnection.newSession).toHaveBeenCalledWith({
          cwd: process.cwd(),
          mcpServers: [],
        })
      })

      it('handles null mcpServers as empty array', async () => {
        mockConnection.newSession.mockResolvedValue({sessionId: 'new'})

        await strategy.createNewSession('/workspace', null)

        expect(mockConnection.newSession).toHaveBeenCalledWith({
          cwd: '/workspace',
          mcpServers: [],
        })
      })

      it('handles undefined mcpServers as empty array', async () => {
        mockConnection.newSession.mockResolvedValue({sessionId: 'new'})

        await strategy.createNewSession('/workspace', undefined)

        expect(mockConnection.newSession).toHaveBeenCalledWith({
          cwd: '/workspace',
          mcpServers: [],
        })
      })
    })

    describe('acquireSession fallback scenarios', () => {
      it('handles network timeout in resume', async () => {
        strategy = new SessionResumeStrategy(mockConnection, {session: {resume: true}})
        mockConnection.unstable_resumeSession.mockRejectedValue(new Error('ETIMEDOUT'))
        mockConnection.newSession.mockResolvedValue({sessionId: 'new-after-timeout'})

        const result = await strategy.acquireSession('old-session', '/workspace', [])

        expect(result).toBe('new-after-timeout')
      })

      it('handles session expired error in resume', async () => {
        strategy = new SessionResumeStrategy(mockConnection, {session: {resume: true}})
        mockConnection.unstable_resumeSession.mockRejectedValue(new Error('Session expired'))
        mockConnection.newSession.mockResolvedValue({sessionId: 'new-after-expiry'})

        const result = await strategy.acquireSession('old-session', '/workspace', [])

        expect(result).toBe('new-after-expiry')
      })

      it('handles protocol version mismatch in resume', async () => {
        strategy = new SessionResumeStrategy(mockConnection, {session: {resume: true}})
        mockConnection.unstable_resumeSession.mockRejectedValue(new Error('Protocol version mismatch'))
        mockConnection.newSession.mockResolvedValue({sessionId: 'new-after-mismatch'})

        const result = await strategy.acquireSession('old-session', '/workspace', [])

        expect(result).toBe('new-after-mismatch')
      })

      it('propagates errors from newSession when fallback also fails', async () => {
        strategy = new SessionResumeStrategy(mockConnection, {session: {resume: true}})
        mockConnection.unstable_resumeSession.mockRejectedValue(new Error('Resume failed'))
        mockConnection.newSession.mockRejectedValue(new Error('New session also failed'))

        await expect(strategy.acquireSession('old-session', '/workspace', [])).rejects.toThrow(
          'New session also failed',
        )
      })
    })

    describe('acquireSession with various sessionId values', () => {
      beforeEach(() => {
        strategy = new SessionResumeStrategy(mockConnection, {session: {resume: true}})
        mockConnection.newSession.mockResolvedValue({sessionId: 'new'})
      })

      it('treats empty string sessionId as falsy and creates new session', async () => {
        await strategy.acquireSession('', '/workspace', [])

        expect(mockConnection.unstable_resumeSession).not.toHaveBeenCalled()
        expect(mockConnection.newSession).toHaveBeenCalled()
      })

      it('treats undefined sessionId as falsy and creates new session', async () => {
        await strategy.acquireSession(undefined, '/workspace', [])

        expect(mockConnection.unstable_resumeSession).not.toHaveBeenCalled()
        expect(mockConnection.newSession).toHaveBeenCalled()
      })

      it('handles very long session IDs', async () => {
        const longSessionId = 'a'.repeat(1000)
        mockConnection.unstable_resumeSession.mockResolvedValue({sessionId: longSessionId})

        const result = await strategy.acquireSession(longSessionId, '/workspace', [])

        expect(mockConnection.unstable_resumeSession).toHaveBeenCalledWith({
          sessionId: longSessionId,
          cwd: '/workspace',
        })
        expect(result).toBe(longSessionId)
      })

      it('handles session IDs with special characters', async () => {
        const specialSessionId = 'session-123_abc.def:456'
        mockConnection.unstable_resumeSession.mockResolvedValue({sessionId: specialSessionId})

        const result = await strategy.acquireSession(specialSessionId, '/workspace', [])

        expect(result).toBe(specialSessionId)
      })
    })

    describe('connection state validation', () => {
      it('throws when connection is undefined in resumeSession', async () => {
        strategy = new SessionResumeStrategy(undefined, {session: {resume: true}})

        await expect(strategy.resumeSession('session-1', '/workspace')).rejects.toThrow('Connection not initialized')
      })

      it('throws when connection is undefined in createNewSession', async () => {
        strategy = new SessionResumeStrategy(undefined, {})

        await expect(strategy.createNewSession('/workspace')).rejects.toThrow('Connection not initialized')
      })

      it('throws when connection becomes null after construction', async () => {
        strategy = new SessionResumeStrategy(mockConnection, {})
        strategy.connection = null

        await expect(strategy.createNewSession('/workspace')).rejects.toThrow('Connection not initialized')
      })
    })

    describe('capability structure variations', () => {
      it('handles deeply nested capability structure', () => {
        const capabilities = {
          session: {
            resume: true,
            fork: false,
            list: true,
          },
          other: {
            feature: true,
          },
        }
        strategy = new SessionResumeStrategy(mockConnection, capabilities)

        expect(strategy.canResumeSession()).toBe(true)
      })

      it('handles capability with extra properties', () => {
        const capabilities = {
          session: {
            resume: true,
            extra: 'ignored',
          },
        }
        strategy = new SessionResumeStrategy(mockConnection, capabilities)

        expect(strategy.canResumeSession()).toBe(true)
      })
    })

    describe('mcpServers variations', () => {
      beforeEach(() => {
        strategy = new SessionResumeStrategy(mockConnection, {})
        mockConnection.newSession.mockResolvedValue({sessionId: 'new'})
      })

      it('handles empty mcpServers array', async () => {
        await strategy.createNewSession('/workspace', [])

        expect(mockConnection.newSession).toHaveBeenCalledWith({
          cwd: '/workspace',
          mcpServers: [],
        })
      })

      it('handles single mcpServer', async () => {
        const servers = [{name: 'server1', url: 'http://localhost:3000'}]
        await strategy.createNewSession('/workspace', servers)

        expect(mockConnection.newSession).toHaveBeenCalledWith({
          cwd: '/workspace',
          mcpServers: servers,
        })
      })

      it('handles multiple mcpServers', async () => {
        const servers = [
          {name: 'server1', url: 'http://localhost:3000'},
          {name: 'server2', url: 'http://localhost:3001'},
          {name: 'server3', url: 'http://localhost:3002'},
        ]
        await strategy.createNewSession('/workspace', servers)

        expect(mockConnection.newSession).toHaveBeenCalledWith({
          cwd: '/workspace',
          mcpServers: servers,
        })
      })
    })
  })
})

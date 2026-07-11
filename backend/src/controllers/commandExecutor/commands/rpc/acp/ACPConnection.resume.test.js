import {ACPConnection} from './ACPConnection'
import {SessionResumeStrategy} from './SessionResumeStrategy'

jest.mock('./SessionResumeStrategy')

describe('ACPConnection session resume', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createSession with resume support', () => {
    it('passes lastSessionId and capabilities to SessionResumeStrategy', async () => {
      const mockAcquireSession = jest.fn().mockResolvedValue('resumed-session-id')
      SessionResumeStrategy.mockImplementation(() => ({
        acquireSession: mockAcquireSession,
      }))

      const connection = new ACPConnection({command: 'test', cwd: '/workspace'})
      connection.connection = {initialize: jest.fn()}
      connection.agentCapabilities = {session: {resume: true}}

      const sessionId = await connection.createSession('previous-session-id')

      expect(SessionResumeStrategy).toHaveBeenCalledWith(connection.connection, {session: {resume: true}})
      expect(mockAcquireSession).toHaveBeenCalledWith('previous-session-id', '/workspace', [])
      expect(sessionId).toBe('resumed-session-id')
      expect(connection.sessionId).toBe('resumed-session-id')
    })

    it('creates new session when lastSessionId is null', async () => {
      const mockAcquireSession = jest.fn().mockResolvedValue('new-session-id')
      SessionResumeStrategy.mockImplementation(() => ({
        acquireSession: mockAcquireSession,
      }))

      const connection = new ACPConnection({command: 'test', cwd: '/workspace'})
      connection.connection = {}
      connection.agentCapabilities = {}

      const sessionId = await connection.createSession(null)

      expect(mockAcquireSession).toHaveBeenCalledWith(null, '/workspace', [])
      expect(sessionId).toBe('new-session-id')
    })

    it('passes undefined lastSessionId when not provided', async () => {
      const mockAcquireSession = jest.fn().mockResolvedValue('new-session-id')
      SessionResumeStrategy.mockImplementation(() => ({
        acquireSession: mockAcquireSession,
      }))

      const connection = new ACPConnection({command: 'test', cwd: '/workspace'})
      connection.connection = {}
      connection.agentCapabilities = {session: {resume: false}}

      await connection.createSession()

      expect(mockAcquireSession).toHaveBeenCalledWith(null, '/workspace', [])
    })

    it('throws when connection not initialized', async () => {
      const connection = new ACPConnection({command: 'test'})

      await expect(connection.createSession('session-id')).rejects.toThrow('Connection not initialized')
    })
  })

  describe('initialize', () => {
    it('stores agent capabilities from initialization response', () => {
      const connection = new ACPConnection({command: 'test'})

      expect(connection.agentCapabilities).toBeNull()
    })
  })

  describe('integration scenarios', () => {
    it('uses SessionResumeStrategy correctly when agent supports resume', async () => {
      const mockAcquireSession = jest.fn().mockResolvedValue('session-from-strategy')
      SessionResumeStrategy.mockImplementation(() => ({
        acquireSession: mockAcquireSession,
      }))

      const connection = new ACPConnection({command: 'cline', args: ['--acp'], cwd: '/project'})
      connection.connection = {initialize: jest.fn()}
      connection.agentCapabilities = {
        session: {resume: true, fork: false},
        protocolVersion: '0.14.0',
      }

      const sessionId = await connection.createSession('prev-session')

      expect(SessionResumeStrategy).toHaveBeenCalledWith(connection.connection, {
        session: {resume: true, fork: false},
        protocolVersion: '0.14.0',
      })
      expect(mockAcquireSession).toHaveBeenCalledWith('prev-session', '/project', [])
      expect(sessionId).toBe('session-from-strategy')
    })

    it('uses SessionResumeStrategy correctly when agent does not support resume', async () => {
      const mockAcquireSession = jest.fn().mockResolvedValue('new-session-only')
      SessionResumeStrategy.mockImplementation(() => ({
        acquireSession: mockAcquireSession,
      }))

      const connection = new ACPConnection({command: 'gemini-cli', cwd: '/workspace'})
      connection.connection = {initialize: jest.fn()}
      connection.agentCapabilities = {
        session: {resume: false},
      }

      await connection.createSession('prev-session')

      expect(mockAcquireSession).toHaveBeenCalledWith('prev-session', '/workspace', [])
    })

    it('handles missing agentCapabilities gracefully', async () => {
      const mockAcquireSession = jest.fn().mockResolvedValue('new-session')
      SessionResumeStrategy.mockImplementation(() => ({
        acquireSession: mockAcquireSession,
      }))

      const connection = new ACPConnection({command: 'test'})
      connection.connection = {}
      connection.agentCapabilities = null

      await connection.createSession()

      expect(SessionResumeStrategy).toHaveBeenCalledWith(connection.connection, null)
      expect(mockAcquireSession).toHaveBeenCalledWith(null, expect.any(String), [])
    })
  })

  describe('edge cases', () => {
    it('handles very long lastSessionId', async () => {
      const longSessionId = 'session-' + 'a'.repeat(500)
      const mockAcquireSession = jest.fn().mockResolvedValue('new-session')
      SessionResumeStrategy.mockImplementation(() => ({
        acquireSession: mockAcquireSession,
      }))

      const connection = new ACPConnection({command: 'test'})
      connection.connection = {}
      connection.agentCapabilities = {}

      await connection.createSession(longSessionId)

      expect(mockAcquireSession).toHaveBeenCalledWith(longSessionId, expect.any(String), [])
    })

    it('handles sessionId with special characters', async () => {
      const specialSessionId = 'session-123_abc.def:456@789'
      const mockAcquireSession = jest.fn().mockResolvedValue(specialSessionId)
      SessionResumeStrategy.mockImplementation(() => ({
        acquireSession: mockAcquireSession,
      }))

      const connection = new ACPConnection({command: 'test'})
      connection.connection = {}
      connection.agentCapabilities = {}

      const result = await connection.createSession(specialSessionId)

      expect(result).toBe(specialSessionId)
    })

    it('propagates errors from SessionResumeStrategy', async () => {
      const mockAcquireSession = jest.fn().mockRejectedValue(new Error('All session creation methods failed'))
      SessionResumeStrategy.mockImplementation(() => ({
        acquireSession: mockAcquireSession,
      }))

      const connection = new ACPConnection({command: 'test'})
      connection.connection = {}
      connection.agentCapabilities = {}

      await expect(connection.createSession()).rejects.toThrow('All session creation methods failed')
    })

    it('updates internal sessionId after createSession succeeds', async () => {
      const mockAcquireSession = jest.fn().mockResolvedValue('final-session-id')
      SessionResumeStrategy.mockImplementation(() => ({
        acquireSession: mockAcquireSession,
      }))

      const connection = new ACPConnection({command: 'test'})
      connection.connection = {}
      connection.agentCapabilities = {}

      expect(connection.sessionId).toBeNull()

      await connection.createSession()

      expect(connection.sessionId).toBe('final-session-id')
      expect(connection.getSessionId()).toBe('final-session-id')
    })

    it('does not update sessionId if createSession fails', async () => {
      const mockAcquireSession = jest.fn().mockRejectedValue(new Error('Failed'))
      SessionResumeStrategy.mockImplementation(() => ({
        acquireSession: mockAcquireSession,
      }))

      const connection = new ACPConnection({command: 'test'})
      connection.connection = {}
      connection.agentCapabilities = {}
      connection.sessionId = 'previous-session'

      await expect(connection.createSession()).rejects.toThrow('Failed')

      expect(connection.sessionId).toBe('previous-session')
    })
  })
})

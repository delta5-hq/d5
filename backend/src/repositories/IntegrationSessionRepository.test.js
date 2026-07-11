import {IntegrationSessionRepository} from './IntegrationSessionRepository'
import IntegrationSession from '../models/IntegrationSession'

jest.mock('../models/IntegrationSession', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}))

describe('IntegrationSessionRepository', () => {
  let repository

  beforeEach(() => {
    jest.clearAllMocks()
    repository = new IntegrationSessionRepository()
  })

  describe('findSession', () => {
    it('finds session by userId, alias, and protocol', async () => {
      const mockSession = {
        userId: 'user1',
        alias: '/vm1',
        protocol: 'rpc',
        lastSessionId: 'session-123',
      }

      IntegrationSession.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockSession),
      })

      const result = await repository.findSession('user1', '/vm1', 'rpc')

      expect(IntegrationSession.findOne).toHaveBeenCalledWith({
        userId: 'user1',
        alias: '/vm1',
        protocol: 'rpc',
      })
      expect(result).toEqual(mockSession)
    })

    it('returns null when session not found', async () => {
      IntegrationSession.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      })

      const result = await repository.findSession('user1', '/vm1', 'rpc')

      expect(result).toBeNull()
    })

    it('handles database errors', async () => {
      IntegrationSession.findOne.mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error('DB error')),
      })

      await expect(repository.findSession('user1', '/vm1', 'rpc')).rejects.toThrow('DB error')
    })
  })

  describe('upsertSessionId', () => {
    it('sets only schema-defined fields in update operation', async () => {
      const mockDoc = {
        userId: 'user1',
        alias: '/vm1',
        protocol: 'rpc',
        lastSessionId: 'session-123',
      }

      IntegrationSession.findOneAndUpdate.mockResolvedValue(mockDoc)

      const result = await repository.upsertSessionId('user1', '/vm1', 'rpc', 'session-123')

      const updateCall = IntegrationSession.findOneAndUpdate.mock.calls[0]
      const setOperation = updateCall[1].$set

      expect(Object.keys(setOperation)).toEqual(['lastSessionId'])
      expect(setOperation).toEqual({lastSessionId: 'session-123'})
      expect(result).toEqual(mockDoc)
    })

    it('creates new session document when none exists', async () => {
      const mockDoc = {
        userId: 'user1',
        alias: '/vm1',
        protocol: 'rpc',
        lastSessionId: 'session-123',
      }

      IntegrationSession.findOneAndUpdate.mockResolvedValue(mockDoc)

      const result = await repository.upsertSessionId('user1', '/vm1', 'rpc', 'session-123')

      expect(IntegrationSession.findOneAndUpdate).toHaveBeenCalledWith(
        {userId: 'user1', alias: '/vm1', protocol: 'rpc'},
        {$set: {lastSessionId: 'session-123'}},
        {upsert: true, new: true},
      )
      expect(result).toEqual(mockDoc)
    })

    it('updates existing session document', async () => {
      const mockDoc = {
        userId: 'user1',
        alias: '/vm1',
        protocol: 'rpc',
        lastSessionId: 'session-456',
      }

      IntegrationSession.findOneAndUpdate.mockResolvedValue(mockDoc)

      await repository.upsertSessionId('user1', '/vm1', 'rpc', 'session-456')

      expect(IntegrationSession.findOneAndUpdate).toHaveBeenCalledWith(
        {userId: 'user1', alias: '/vm1', protocol: 'rpc'},
        {$set: {lastSessionId: 'session-456'}},
        {upsert: true, new: true},
      )
    })

    it('handles concurrent upserts for same session', async () => {
      IntegrationSession.findOneAndUpdate
        .mockResolvedValueOnce({lastSessionId: 'session-1'})
        .mockResolvedValueOnce({lastSessionId: 'session-2'})

      const results = await Promise.all([
        repository.upsertSessionId('user1', '/vm1', 'rpc', 'session-1'),
        repository.upsertSessionId('user1', '/vm1', 'rpc', 'session-2'),
      ])

      expect(IntegrationSession.findOneAndUpdate).toHaveBeenCalledTimes(2)
      expect(results[0].lastSessionId).toBe('session-1')
      expect(results[1].lastSessionId).toBe('session-2')
    })

    it('handles upserts for different users with same alias', async () => {
      IntegrationSession.findOneAndUpdate.mockResolvedValue({})

      await Promise.all([
        repository.upsertSessionId('user1', '/vm1', 'rpc', 'session-1'),
        repository.upsertSessionId('user2', '/vm1', 'rpc', 'session-2'),
      ])

      expect(IntegrationSession.findOneAndUpdate).toHaveBeenNthCalledWith(
        1,
        {userId: 'user1', alias: '/vm1', protocol: 'rpc'},
        expect.any(Object),
        expect.any(Object),
      )
      expect(IntegrationSession.findOneAndUpdate).toHaveBeenNthCalledWith(
        2,
        {userId: 'user2', alias: '/vm1', protocol: 'rpc'},
        expect.any(Object),
        expect.any(Object),
      )
    })

    it('handles database errors during upsert', async () => {
      IntegrationSession.findOneAndUpdate.mockRejectedValue(new Error('Duplicate key error'))

      await expect(repository.upsertSessionId('user1', '/vm1', 'rpc', 'session-123')).rejects.toThrow(
        'Duplicate key error',
      )
    })
  })

  describe('getLastSessionId', () => {
    it('returns sessionId when session exists', async () => {
      IntegrationSession.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({lastSessionId: 'session-123'}),
      })

      const result = await repository.getLastSessionId('user1', '/vm1', 'rpc')

      expect(result).toBe('session-123')
    })

    it('returns null when session does not exist', async () => {
      IntegrationSession.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      })

      const result = await repository.getLastSessionId('user1', '/vm1', 'rpc')

      expect(result).toBeNull()
    })

    it('returns null when session exists but lastSessionId is undefined', async () => {
      IntegrationSession.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({userId: 'user1', alias: '/vm1'}),
      })

      const result = await repository.getLastSessionId('user1', '/vm1', 'rpc')

      expect(result).toBeNull()
    })

    it('handles database errors', async () => {
      IntegrationSession.findOne.mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error('Connection timeout')),
      })

      await expect(repository.getLastSessionId('user1', '/vm1', 'rpc')).rejects.toThrow('Connection timeout')
    })
  })

  describe('protocol differentiation', () => {
    it('isolates sessions by protocol', async () => {
      IntegrationSession.findOneAndUpdate.mockResolvedValue({})

      await repository.upsertSessionId('user1', '/alias1', 'rpc', 'rpc-session')
      await repository.upsertSessionId('user1', '/alias1', 'mcp', 'mcp-session')

      expect(IntegrationSession.findOneAndUpdate).toHaveBeenNthCalledWith(
        1,
        {userId: 'user1', alias: '/alias1', protocol: 'rpc'},
        {$set: {lastSessionId: 'rpc-session'}},
        {upsert: true, new: true},
      )
      expect(IntegrationSession.findOneAndUpdate).toHaveBeenNthCalledWith(
        2,
        {userId: 'user1', alias: '/alias1', protocol: 'mcp'},
        {$set: {lastSessionId: 'mcp-session'}},
        {upsert: true, new: true},
      )
    })
  })

  describe('edge cases', () => {
    it('handles very long session IDs', async () => {
      const longSessionId = 'x'.repeat(10000)
      IntegrationSession.findOneAndUpdate.mockResolvedValue({lastSessionId: longSessionId})

      const result = await repository.upsertSessionId('user1', '/vm1', 'rpc', longSessionId)

      expect(result.lastSessionId).toBe(longSessionId)
    })

    it('handles special characters in alias names', async () => {
      IntegrationSession.findOneAndUpdate.mockResolvedValue({})

      await repository.upsertSessionId('user1', '/vm-test_123', 'rpc', 'session-123')

      expect(IntegrationSession.findOneAndUpdate).toHaveBeenCalledWith(
        {userId: 'user1', alias: '/vm-test_123', protocol: 'rpc'},
        expect.any(Object),
        expect.any(Object),
      )
    })

    it('handles special characters in user IDs', async () => {
      IntegrationSession.findOneAndUpdate.mockResolvedValue({})

      await repository.upsertSessionId('user@email.com', '/vm1', 'rpc', 'session-123')

      expect(IntegrationSession.findOneAndUpdate).toHaveBeenCalledWith(
        {userId: 'user@email.com', alias: '/vm1', protocol: 'rpc'},
        expect.any(Object),
        expect.any(Object),
      )
    })

    it('handles empty string session ID', async () => {
      IntegrationSession.findOneAndUpdate.mockResolvedValue({lastSessionId: ''})

      const result = await repository.upsertSessionId('user1', '/vm1', 'rpc', '')

      expect(result.lastSessionId).toBe('')
    })
  })

  describe('performance considerations', () => {
    it('handles batch operations efficiently', async () => {
      IntegrationSession.findOneAndUpdate.mockResolvedValue({})

      const operations = Array.from({length: 100}, (_, i) =>
        repository.upsertSessionId(`user${i}`, `/vm${i}`, 'rpc', `session-${i}`),
      )

      await Promise.all(operations)

      expect(IntegrationSession.findOneAndUpdate).toHaveBeenCalledTimes(100)
    })
  })
})

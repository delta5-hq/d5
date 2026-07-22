import {SessionHydrator} from './SessionHydrator'

describe('SessionHydrator', () => {
  let mockRepository
  let hydrator

  beforeEach(() => {
    mockRepository = {
      getLastSessionId: jest.fn(),
      findSession: jest.fn(),
      upsertSessionId: jest.fn(),
    }
    hydrator = new SessionHydrator(mockRepository)
  })

  describe('hydrateRPCAliases', () => {
    it('returns empty array when no aliases provided', async () => {
      const result = await hydrator.hydrateRPCAliases('user1', [])

      expect(result).toEqual([])
      expect(mockRepository.getLastSessionId).not.toHaveBeenCalled()
    })

    it('returns undefined input unchanged', async () => {
      const result = await hydrator.hydrateRPCAliases('user1', undefined)

      expect(result).toBeUndefined()
    })

    it('hydrates single alias with session', async () => {
      mockRepository.getLastSessionId.mockResolvedValue('session-123')

      const aliases = [{alias: '/vm1', protocol: 'ssh'}]
      const result = await hydrator.hydrateRPCAliases('user1', aliases)

      expect(mockRepository.getLastSessionId).toHaveBeenCalledWith('user1', '/vm1', 'rpc')
      expect(result).toEqual([{alias: '/vm1', protocol: 'ssh', lastSessionId: 'session-123'}])
    })

    it('hydrates multiple aliases with sessions', async () => {
      mockRepository.getLastSessionId
        .mockResolvedValueOnce('session-1')
        .mockResolvedValueOnce('session-2')
        .mockResolvedValueOnce(null)

      const aliases = [{alias: '/vm1'}, {alias: '/vm2'}, {alias: '/vm3'}]
      const result = await hydrator.hydrateRPCAliases('user1', aliases)

      expect(mockRepository.getLastSessionId).toHaveBeenCalledTimes(3)
      expect(result[0].lastSessionId).toBe('session-1')
      expect(result[1].lastSessionId).toBe('session-2')
      expect(result[2].lastSessionId).toBeNull()
    })

    it('preserves all original alias properties', async () => {
      mockRepository.getLastSessionId.mockResolvedValue('session-123')

      const aliases = [
        {
          alias: '/vm1',
          protocol: 'ssh',
          host: 'vm1.example.com',
          port: 22,
          username: 'deploy',
          privateKey: 'encrypted-key',
          customField: 'custom-value',
        },
      ]
      const result = await hydrator.hydrateRPCAliases('user1', aliases)

      expect(result[0]).toEqual({
        alias: '/vm1',
        protocol: 'ssh',
        host: 'vm1.example.com',
        port: 22,
        username: 'deploy',
        privateKey: 'encrypted-key',
        customField: 'custom-value',
        lastSessionId: 'session-123',
      })
    })

    it('handles repository errors gracefully', async () => {
      mockRepository.getLastSessionId.mockRejectedValue(new Error('DB connection lost'))

      const aliases = [{alias: '/vm1'}]

      await expect(hydrator.hydrateRPCAliases('user1', aliases)).rejects.toThrow('DB connection lost')
    })

    it('handles concurrent hydration for multiple aliases', async () => {
      mockRepository.getLastSessionId.mockImplementation(
        (userId, alias) => new Promise(resolve => setTimeout(() => resolve(`session-${alias}`), Math.random() * 10)),
      )

      const aliases = Array.from({length: 10}, (_, i) => ({alias: `/vm${i}`}))
      const result = await hydrator.hydrateRPCAliases('user1', aliases)

      expect(result).toHaveLength(10)
      result.forEach((item, i) => {
        expect(item.lastSessionId).toBe(`session-/vm${i}`)
      })
    })
  })

  describe('hydrateMCPAliases', () => {
    it('returns input unchanged as MCP aliases do not have sessions', async () => {
      const aliases = [{alias: '/coder1'}, {alias: '/agent2'}]
      const result = await hydrator.hydrateMCPAliases(aliases)

      expect(result).toBe(aliases)
      expect(mockRepository.getLastSessionId).not.toHaveBeenCalled()
    })

    it('handles empty array', async () => {
      const result = await hydrator.hydrateMCPAliases([])

      expect(result).toEqual([])
    })

    it('handles undefined input', async () => {
      const result = await hydrator.hydrateMCPAliases(undefined)

      expect(result).toBeUndefined()
    })
  })

  describe('hydrateAll', () => {
    it('hydrates both MCP and RPC aliases', async () => {
      mockRepository.getLastSessionId.mockResolvedValue('session-123')

      const aliases = {
        mcp: [{alias: '/coder1'}],
        rpc: [{alias: '/vm1'}],
      }

      const result = await hydrator.hydrateAll('user1', aliases)

      expect(result.mcp).toEqual([{alias: '/coder1'}])
      expect(result.rpc).toEqual([{alias: '/vm1', lastSessionId: 'session-123'}])
      expect(mockRepository.getLastSessionId).toHaveBeenCalledTimes(1)
    })

    it('handles empty alias collections', async () => {
      const result = await hydrator.hydrateAll('user1', {mcp: [], rpc: []})

      expect(result).toEqual({mcp: [], rpc: []})
    })

    it('handles missing mcp field', async () => {
      mockRepository.getLastSessionId.mockResolvedValue('session-123')

      const aliases = {
        rpc: [{alias: '/vm1'}],
      }

      const result = await hydrator.hydrateAll('user1', aliases)

      expect(result.mcp).toBeUndefined()
      expect(result.rpc).toEqual([{alias: '/vm1', lastSessionId: 'session-123'}])
    })

    it('handles missing rpc field', async () => {
      const aliases = {
        mcp: [{alias: '/coder1'}],
      }

      const result = await hydrator.hydrateAll('user1', aliases)

      expect(result.mcp).toEqual([{alias: '/coder1'}])
      expect(result.rpc).toBeUndefined()
    })

    it('hydrates multiple RPC aliases in parallel', async () => {
      mockRepository.getLastSessionId
        .mockResolvedValueOnce('session-1')
        .mockResolvedValueOnce('session-2')
        .mockResolvedValueOnce('session-3')

      const aliases = {
        mcp: [{alias: '/coder1'}, {alias: '/coder2'}],
        rpc: [{alias: '/vm1'}, {alias: '/vm2'}, {alias: '/vm3'}],
      }

      const result = await hydrator.hydrateAll('user1', aliases)

      expect(mockRepository.getLastSessionId).toHaveBeenCalledTimes(3)
      expect(result.rpc[0].lastSessionId).toBe('session-1')
      expect(result.rpc[1].lastSessionId).toBe('session-2')
      expect(result.rpc[2].lastSessionId).toBe('session-3')
    })

    it('propagates RPC hydration errors', async () => {
      mockRepository.getLastSessionId.mockRejectedValue(new Error('Session lookup failed'))

      const aliases = {
        mcp: [],
        rpc: [{alias: '/vm1'}],
      }

      await expect(hydrator.hydrateAll('user1', aliases)).rejects.toThrow('Session lookup failed')
    })
  })

  describe('edge cases', () => {
    it('handles aliases with special characters', async () => {
      mockRepository.getLastSessionId.mockResolvedValue('session-123')

      const aliases = [{alias: '/vm-test_123'}]
      const result = await hydrator.hydrateRPCAliases('user1', aliases)

      expect(mockRepository.getLastSessionId).toHaveBeenCalledWith('user1', '/vm-test_123', 'rpc')
      expect(result[0].lastSessionId).toBe('session-123')
    })

    it('handles user IDs with special characters', async () => {
      mockRepository.getLastSessionId.mockResolvedValue('session-123')

      const aliases = [{alias: '/vm1'}]
      await hydrator.hydrateRPCAliases('user@email.com', aliases)

      expect(mockRepository.getLastSessionId).toHaveBeenCalledWith('user@email.com', '/vm1', 'rpc')
    })

    it('handles very long session IDs', async () => {
      const longSessionId = 'a'.repeat(1000)
      mockRepository.getLastSessionId.mockResolvedValue(longSessionId)

      const aliases = [{alias: '/vm1'}]
      const result = await hydrator.hydrateRPCAliases('user1', aliases)

      expect(result[0].lastSessionId).toBe(longSessionId)
    })

    it('does not mutate input aliases', async () => {
      mockRepository.getLastSessionId.mockResolvedValue('session-123')

      const originalAliases = [{alias: '/vm1', host: 'example.com'}]
      const inputCopy = JSON.parse(JSON.stringify(originalAliases))

      await hydrator.hydrateRPCAliases('user1', originalAliases)

      expect(originalAliases).toEqual(inputCopy)
    })
  })
})

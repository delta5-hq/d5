import {IntegrationRepository} from './IntegrationRepository'
import Integration from '../models/Integration'

jest.mock('../models/Integration', () => ({
  findOne: jest.fn(),
}))

describe('IntegrationRepository', () => {
  let repository

  beforeEach(() => {
    repository = new IntegrationRepository()
    jest.clearAllMocks()
  })

  describe('findByWorkflow', () => {
    it('returns null when workflowId is not provided', async () => {
      const result = await repository.findByWorkflow('user-1', null)

      expect(result).toBeNull()
      expect(Integration.findOne).not.toHaveBeenCalled()
    })

    it('queries with userId and workflowId when both provided', async () => {
      const mockData = {userId: 'user-1', workflowId: 'wf-1', openai: {apiKey: 'key'}}
      Integration.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockData),
      })

      const result = await repository.findByWorkflow('user-1', 'wf-1')

      expect(Integration.findOne).toHaveBeenCalledWith({userId: 'user-1', workflowId: 'wf-1'})
      expect(result).toEqual(mockData)
    })

    it('returns null when no workflow-specific integration exists', async () => {
      Integration.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      })

      const result = await repository.findByWorkflow('user-1', 'wf-1')

      expect(result).toBeNull()
    })

    it('handles database errors', async () => {
      Integration.findOne.mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error('Connection timeout')),
      })

      await expect(repository.findByWorkflow('user-1', 'wf-1')).rejects.toThrow('Connection timeout')
    })
  })

  describe('findByUser', () => {
    it('queries with userId and workflowId=null', async () => {
      const mockData = {userId: 'user-1', workflowId: null, openai: {apiKey: 'key'}}
      Integration.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockData),
      })

      const result = await repository.findByUser('user-1')

      expect(Integration.findOne).toHaveBeenCalledWith({userId: 'user-1', workflowId: null})
      expect(result).toEqual(mockData)
    })

    it('returns null when no user default exists', async () => {
      Integration.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      })

      const result = await repository.findByUser('user-1')

      expect(result).toBeNull()
    })

    it('handles database errors', async () => {
      Integration.findOne.mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error('Database error')),
      })

      await expect(repository.findByUser('user-1')).rejects.toThrow('Database error')
    })
  })

  describe('findWithFallback', () => {
    it.each([
      [null, 'null'],
      [undefined, 'undefined'],
      ['', 'empty string'],
    ])('returns user default when workflowId is %s (%s)', async workflowId => {
      const mockUserDefault = {userId: 'user-1', workflowId: null, openai: {apiKey: 'default-key'}}
      Integration.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUserDefault),
      })

      const result = await repository.findWithFallback('user-1', workflowId)

      expect(Integration.findOne).toHaveBeenCalledWith({userId: 'user-1', workflowId: null})
      expect(result).toEqual(mockUserDefault)
    })

    it('returns workflow-specific integration when it exists', async () => {
      const mockWorkflowSpecific = {userId: 'user-1', workflowId: 'wf-1', openai: {apiKey: 'wf-key'}}
      Integration.findOne.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue(mockWorkflowSpecific),
      })

      const result = await repository.findWithFallback('user-1', 'wf-1')

      expect(Integration.findOne).toHaveBeenCalledWith({userId: 'user-1', workflowId: 'wf-1'})
      expect(result).toEqual(mockWorkflowSpecific)
    })

    it('falls back to user default when workflow-specific does not exist', async () => {
      const mockUserDefault = {userId: 'user-1', workflowId: null, openai: {apiKey: 'default-key'}}
      Integration.findOne
        .mockReturnValueOnce({
          lean: jest.fn().mockResolvedValue(null),
        })
        .mockReturnValueOnce({
          lean: jest.fn().mockResolvedValue(mockUserDefault),
        })

      const result = await repository.findWithFallback('user-1', 'wf-1')

      expect(Integration.findOne).toHaveBeenNthCalledWith(1, {userId: 'user-1', workflowId: 'wf-1'})
      expect(Integration.findOne).toHaveBeenNthCalledWith(2, {userId: 'user-1', workflowId: null})
      expect(result).toEqual(mockUserDefault)
    })

    it('returns null when neither workflow-specific nor user default exists', async () => {
      Integration.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      })

      const result = await repository.findWithFallback('user-1', 'wf-1')

      expect(result).toBeNull()
    })

    it('handles database errors in workflow-specific query', async () => {
      Integration.findOne.mockReturnValueOnce({
        lean: jest.fn().mockRejectedValue(new Error('Connection timeout')),
      })

      await expect(repository.findWithFallback('user-1', 'wf-1')).rejects.toThrow('Connection timeout')
    })

    it('handles database errors in user default fallback query', async () => {
      Integration.findOne
        .mockReturnValueOnce({
          lean: jest.fn().mockResolvedValue(null),
        })
        .mockReturnValueOnce({
          lean: jest.fn().mockRejectedValue(new Error('Database unavailable')),
        })

      await expect(repository.findWithFallback('user-1', 'wf-1')).rejects.toThrow('Database unavailable')
    })
  })

  describe('workflow isolation', () => {
    it('returns different integrations for different workflows of same user', async () => {
      const mockWorkflowA = {userId: 'user-1', workflowId: 'wf-A', claude: {apiKey: 'key-A'}}
      const mockWorkflowB = {userId: 'user-1', workflowId: 'wf-B', claude: {apiKey: 'key-B'}}

      Integration.findOne.mockImplementation(filter => {
        if (filter.workflowId === 'wf-A') {
          return {lean: jest.fn().mockResolvedValue(mockWorkflowA)}
        }
        if (filter.workflowId === 'wf-B') {
          return {lean: jest.fn().mockResolvedValue(mockWorkflowB)}
        }
        return {lean: jest.fn().mockResolvedValue(null)}
      })

      const resultA = await repository.findWithFallback('user-1', 'wf-A')
      const resultB = await repository.findWithFallback('user-1', 'wf-B')

      expect(resultA).toEqual(mockWorkflowA)
      expect(resultB).toEqual(mockWorkflowB)
      expect(resultA.claude.apiKey).not.toEqual(resultB.claude.apiKey)
    })

    it('returns same user-default for multiple workflows when no workflow-specific exists', async () => {
      const mockUserDefault = {userId: 'user-1', workflowId: null, openai: {apiKey: 'shared-key'}}

      Integration.findOne.mockImplementation(filter => {
        if (filter.workflowId === null) {
          return {lean: jest.fn().mockResolvedValue(mockUserDefault)}
        }
        return {lean: jest.fn().mockResolvedValue(null)}
      })

      const resultWfA = await repository.findWithFallback('user-1', 'wf-A')
      const resultWfB = await repository.findWithFallback('user-1', 'wf-B')

      expect(resultWfA).toEqual(mockUserDefault)
      expect(resultWfB).toEqual(mockUserDefault)
      expect(resultWfA.openai.apiKey).toEqual(resultWfB.openai.apiKey)
    })

    it('isolates integrations between different users', async () => {
      Integration.findOne.mockImplementation(filter => {
        if (filter.userId === 'user-1') {
          return {lean: jest.fn().mockResolvedValue({userId: 'user-1', openai: {apiKey: 'key-1'}})}
        }
        if (filter.userId === 'user-2') {
          return {lean: jest.fn().mockResolvedValue({userId: 'user-2', openai: {apiKey: 'key-2'}})}
        }
        return {lean: jest.fn().mockResolvedValue(null)}
      })

      const result1 = await repository.findByUser('user-1')
      const result2 = await repository.findByUser('user-2')

      expect(result1.openai.apiKey).toBe('key-1')
      expect(result2.openai.apiKey).toBe('key-2')
    })
  })

  describe('edge cases', () => {
    it('handles integration documents with all fields populated', async () => {
      const fullIntegration = {
        userId: 'user-1',
        workflowId: 'wf-1',
        openai: {apiKey: 'sk-...'},
        claude: {apiKey: 'sk-ant-...'},
        mcp: [{alias: '/coder1', serverUrl: 'http://...'}],
        rpc: [{alias: '/vm1', protocol: 'ssh', host: '192.168.1.1'}],
        lang: 'en',
        model: 'OpenAI',
      }

      Integration.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(fullIntegration),
      })

      const result = await repository.findWithFallback('user-1', 'wf-1')

      expect(result).toEqual(fullIntegration)
      expect(result.mcp).toHaveLength(1)
      expect(result.rpc).toHaveLength(1)
    })

    it('handles integration documents with minimal fields', async () => {
      const minimalIntegration = {
        userId: 'user-1',
        workflowId: null,
        openai: {apiKey: 'sk-...'},
      }

      Integration.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(minimalIntegration),
      })

      const result = await repository.findByUser('user-1')

      expect(result).toEqual(minimalIntegration)
      expect(result.mcp).toBeUndefined()
      expect(result.rpc).toBeUndefined()
    })

    it('handles special characters in userId', async () => {
      Integration.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({userId: 'user@email.com'}),
      })

      await repository.findByUser('user@email.com')

      expect(Integration.findOne).toHaveBeenCalledWith({userId: 'user@email.com', workflowId: null})
    })

    it('handles special characters in workflowId', async () => {
      Integration.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({workflowId: 'wf-$pecial@2024'}),
      })

      await repository.findByWorkflow('user-1', 'wf-$pecial@2024')

      expect(Integration.findOne).toHaveBeenCalledWith({userId: 'user-1', workflowId: 'wf-$pecial@2024'})
    })

    it('handles very long workflowId strings', async () => {
      const longWorkflowId = 'wf-' + 'x'.repeat(1000)
      Integration.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({workflowId: longWorkflowId}),
      })

      await repository.findByWorkflow('user-1', longWorkflowId)

      expect(Integration.findOne).toHaveBeenCalledWith({userId: 'user-1', workflowId: longWorkflowId})
    })
  })

  describe('concurrent operations', () => {
    it('handles concurrent lookups for different workflows', async () => {
      let callCount = 0
      Integration.findOne.mockImplementation(filter => {
        callCount++
        return {
          lean: jest.fn().mockResolvedValue({workflowId: filter.workflowId}),
        }
      })

      const results = await Promise.all([
        repository.findWithFallback('user-1', 'wf-1'),
        repository.findWithFallback('user-1', 'wf-2'),
        repository.findWithFallback('user-1', 'wf-3'),
      ])

      expect(callCount).toBeGreaterThanOrEqual(3)
      expect(results[0].workflowId).toBe('wf-1')
      expect(results[1].workflowId).toBe('wf-2')
      expect(results[2].workflowId).toBe('wf-3')
    })

    it('handles concurrent lookups for different users', async () => {
      Integration.findOne.mockImplementation(filter => ({
        lean: jest.fn().mockResolvedValue({userId: filter.userId}),
      }))

      const results = await Promise.all([
        repository.findByUser('user-1'),
        repository.findByUser('user-2'),
        repository.findByUser('user-3'),
      ])

      expect(results[0].userId).toBe('user-1')
      expect(results[1].userId).toBe('user-2')
      expect(results[2].userId).toBe('user-3')
    })
  })
})

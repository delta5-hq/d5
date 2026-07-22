import {UserContextProvider} from '../../context/UserContextProvider'
import IntegrationFacade from '../../../../repositories/IntegrationFacade'

jest.mock('../../../../repositories/IntegrationFacade', () => ({
  findMergedDecryptedWithMetadata: jest.fn(),
}))

jest.mock('../../../../controllers/commandExecutor/commands/utils/langchain/IntegrationSettingsResolver', () => ({
  resolveSettings: jest.fn(({merged, workflowDoc, userId, workflowId}) => ({
    settings: merged ?? {userId, workflowId, model: 'auto'},
    workflowDoc: workflowDoc ?? null,
  })),
}))

describe('UserContextProvider', () => {
  let provider

  beforeEach(() => {
    jest.clearAllMocks()
    provider = new UserContextProvider('test-user-123')
  })

  describe('getUserId', () => {
    it('returns the userId provided at construction', () => {
      expect(provider.getUserId()).toBe('test-user-123')
    })

    it('returns consistent value across multiple calls', () => {
      expect(provider.getUserId()).toBe('test-user-123')
      expect(provider.getUserId()).toBe('test-user-123')
      expect(provider.getUserId()).toBe('test-user-123')
    })

    it.each([
      ['alphanumeric', 'user123'],
      ['UUID format', '550e8400-e29b-41d4-a716-446655440000'],
      ['email format', 'user@example.com'],
      ['with hyphens', 'user-test-123'],
      ['with underscores', 'user_test_123'],
    ])('handles various userId formats — %s', (_label, userId) => {
      const p = new UserContextProvider(userId)
      expect(p.getUserId()).toBe(userId)
    })
  })

  describe('getIntegrationSettings', () => {
    it('returns resolved settings via full resolution pipeline', async () => {
      const mockSettings = {openai: {apiKey: 'test-key'}}
      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
        merged: mockSettings,
        workflowDoc: null,
      })

      const result = await provider.getIntegrationSettings()

      expect(IntegrationFacade.findMergedDecryptedWithMetadata).toHaveBeenCalledWith('test-user-123', null)
      expect(result).toEqual(expect.objectContaining({openai: {apiKey: 'test-key'}}))
    })

    it('forwards workflowId when provider is scoped to a workflow', async () => {
      const scopedProvider = new UserContextProvider('test-user-123', 'workflow-456')
      IntegrationFacade.findMergedDecryptedWithMetadata.mockResolvedValue({
        merged: {openai: {apiKey: 'key'}},
        workflowDoc: null,
      })

      await scopedProvider.getIntegrationSettings()

      expect(IntegrationFacade.findMergedDecryptedWithMetadata).toHaveBeenCalledWith('test-user-123', 'workflow-456')
    })

    it('propagates facade errors', async () => {
      IntegrationFacade.findMergedDecryptedWithMetadata.mockRejectedValue(new Error('DB failure'))

      await expect(provider.getIntegrationSettings()).rejects.toThrow('DB failure')
    })

    it('propagates decryption errors', async () => {
      IntegrationFacade.findMergedDecryptedWithMetadata.mockRejectedValue(new Error('Decryption failed'))

      await expect(provider.getIntegrationSettings()).rejects.toThrow('Decryption failed')
    })

    it('fetches fresh settings on each call without caching', async () => {
      IntegrationFacade.findMergedDecryptedWithMetadata
        .mockResolvedValueOnce({merged: {openai: {apiKey: 'key1'}}, workflowDoc: null})
        .mockResolvedValueOnce({merged: {openai: {apiKey: 'key2'}}, workflowDoc: null})

      const result1 = await provider.getIntegrationSettings()
      const result2 = await provider.getIntegrationSettings()

      expect(IntegrationFacade.findMergedDecryptedWithMetadata).toHaveBeenCalledTimes(2)
      expect(result1.openai.apiKey).toBe('key1')
      expect(result2.openai.apiKey).toBe('key2')
    })
  })

  describe('constructor', () => {
    it('stores userId reference', () => {
      expect(provider.userId).toBe('test-user-123')
    })

    it('handles empty string userId', () => {
      const p = new UserContextProvider('')
      expect(p.getUserId()).toBe('')
    })
  })
})

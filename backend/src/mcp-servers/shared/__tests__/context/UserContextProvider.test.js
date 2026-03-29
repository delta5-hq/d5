import {UserContextProvider} from '../../context/UserContextProvider'
import IntegrationFacade from '../../../../repositories/IntegrationFacade'

jest.mock('../../../../repositories/IntegrationFacade', () => ({
  findDecryptedOrThrow: jest.fn(),
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
    it('delegates to IntegrationFacade.findDecryptedOrThrow with userId', async () => {
      const mockSettings = {openai: {apiKey: 'test-key'}}
      IntegrationFacade.findDecryptedOrThrow.mockResolvedValue(mockSettings)

      const result = await provider.getIntegrationSettings()

      expect(IntegrationFacade.findDecryptedOrThrow).toHaveBeenCalledWith('test-user-123', null)
      expect(result).toBe(mockSettings)
    })

    it('always passes null as workflowId', async () => {
      IntegrationFacade.findDecryptedOrThrow.mockResolvedValue({})

      await provider.getIntegrationSettings()

      expect(IntegrationFacade.findDecryptedOrThrow).toHaveBeenCalledWith(expect.any(String), null)
    })

    it('propagates integration not found errors', async () => {
      IntegrationFacade.findDecryptedOrThrow.mockRejectedValue(new Error('Integration not found'))

      await expect(provider.getIntegrationSettings()).rejects.toThrow('Integration not found')
    })

    it('propagates decryption errors', async () => {
      IntegrationFacade.findDecryptedOrThrow.mockRejectedValue(new Error('Decryption failed'))

      await expect(provider.getIntegrationSettings()).rejects.toThrow('Decryption failed')
    })

    it('can be called multiple times', async () => {
      IntegrationFacade.findDecryptedOrThrow.mockResolvedValue({openai: {apiKey: 'key'}})

      await provider.getIntegrationSettings()
      await provider.getIntegrationSettings()
      await provider.getIntegrationSettings()

      expect(IntegrationFacade.findDecryptedOrThrow).toHaveBeenCalledTimes(3)
    })

    it('returns different results if facade state changes', async () => {
      IntegrationFacade.findDecryptedOrThrow
        .mockResolvedValueOnce({openai: {apiKey: 'key1'}})
        .mockResolvedValueOnce({openai: {apiKey: 'key2'}})

      const result1 = await provider.getIntegrationSettings()
      const result2 = await provider.getIntegrationSettings()

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

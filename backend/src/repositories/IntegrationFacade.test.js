import IntegrationFacade from './IntegrationFacade'
import IntegrationRepository from './IntegrationRepository'
import {decryptFields} from '../models/utils/fieldEncryption'

jest.mock('./IntegrationRepository')
jest.mock('../models/utils/fieldEncryption')

describe('IntegrationFacade', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('findDecrypted', () => {
    it('returns null when integration not found', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue(null)

      const result = await IntegrationFacade.findDecrypted('user-1')

      expect(result).toBeNull()
      expect(decryptFields).not.toHaveBeenCalled()
    })

    it('does not call decryptFields when integration is missing', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue(null)

      await IntegrationFacade.findDecrypted('user-1')

      expect(decryptFields).not.toHaveBeenCalled()
    })

    it('returns decrypted integration when found', async () => {
      const encrypted = {userId: 'user-1', openai: {apiKey: 'encrypted-key', model: 'gpt-4'}}
      const decrypted = {userId: 'user-1', openai: {apiKey: 'sk-real-key', model: 'gpt-4'}}

      IntegrationRepository.findWithFallback.mockResolvedValue(encrypted)
      decryptFields.mockReturnValue(decrypted)

      const result = await IntegrationFacade.findDecrypted('user-1')

      expect(result).toEqual(decrypted)
      expect(decryptFields).toHaveBeenCalledWith(encrypted, expect.any(Object))
    })

    it.each([
      [null, 'null', null],
      [undefined, 'undefined', null],
      ['', 'empty string', ''],
      ['wf-123', 'valid workflowId', 'wf-123'],
    ])('delegates workflowId=%s (%s) to repository', async (workflowId, _label, expectedValue) => {
      IntegrationRepository.findWithFallback.mockResolvedValue({userId: 'user-1'})
      decryptFields.mockReturnValue({userId: 'user-1'})

      await IntegrationFacade.findDecrypted('user-1', workflowId)

      expect(IntegrationRepository.findWithFallback).toHaveBeenCalledWith('user-1', expectedValue)
    })

    it('propagates repository errors', async () => {
      IntegrationRepository.findWithFallback.mockRejectedValue(new Error('Connection timeout'))

      await expect(IntegrationFacade.findDecrypted('user-1')).rejects.toThrow('Connection timeout')
    })

    it('propagates decryption errors', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue({userId: 'user-1'})
      decryptFields.mockImplementation(() => {
        throw new Error('Decryption failed: invalid key')
      })

      await expect(IntegrationFacade.findDecrypted('user-1')).rejects.toThrow('Decryption failed: invalid key')
    })
  })

  describe('findDecryptedOrThrow', () => {
    it('throws when integration not found', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue(null)

      await expect(IntegrationFacade.findDecryptedOrThrow('user-1')).rejects.toThrow('Integration not found')
    })

    it('returns decrypted integration when found', async () => {
      const encrypted = {userId: 'user-1', openai: {apiKey: 'encrypted'}}
      const decrypted = {userId: 'user-1', openai: {apiKey: 'sk-key'}}

      IntegrationRepository.findWithFallback.mockResolvedValue(encrypted)
      decryptFields.mockReturnValue(decrypted)

      const result = await IntegrationFacade.findDecryptedOrThrow('user-1')

      expect(result).toEqual(decrypted)
    })

    it('delegates workflowId to repository', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue(null)

      await expect(IntegrationFacade.findDecryptedOrThrow('user-1', 'wf-123')).rejects.toThrow('Integration not found')
      expect(IntegrationRepository.findWithFallback).toHaveBeenCalledWith('user-1', 'wf-123')
    })

    it('propagates repository errors over "not found"', async () => {
      IntegrationRepository.findWithFallback.mockRejectedValue(new Error('Database unavailable'))

      await expect(IntegrationFacade.findDecryptedOrThrow('user-1')).rejects.toThrow('Database unavailable')
    })

    it('propagates decryption errors over "not found"', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue({userId: 'user-1'})
      decryptFields.mockImplementation(() => {
        throw new Error('Invalid encryption key')
      })

      await expect(IntegrationFacade.findDecryptedOrThrow('user-1')).rejects.toThrow('Invalid encryption key')
    })
  })

  describe('encryption configuration', () => {
    it('passes config with expected structure', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue({userId: 'user-1'})
      decryptFields.mockImplementation((data, config) => {
        expect(config).toHaveProperty('fields')
        expect(config).toHaveProperty('arrayFields')
        return data
      })

      await IntegrationFacade.findDecrypted('user-1')

      expect(decryptFields).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({fields: expect.any(Array), arrayFields: expect.any(Object)}),
      )
    })
  })
})

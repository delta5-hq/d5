import IntegrationFacade from './IntegrationFacade'
import IntegrationRepository from './IntegrationRepository'
import IntegrationMerger from './IntegrationMerger'
import {decryptFields} from '../models/utils/fieldEncryption'

jest.mock('./IntegrationRepository')
jest.mock('./IntegrationMerger')
jest.mock('../models/utils/fieldEncryption')

describe('IntegrationFacade', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('findDecrypted', () => {
    it('returns null when both app-wide and workflow integrations not found', async () => {
      IntegrationRepository.findBothDocs.mockResolvedValue({appWide: null, workflow: null})
      IntegrationMerger.merge.mockReturnValue(null)

      const result = await IntegrationFacade.findDecrypted('user-1')

      expect(result).toBeNull()
      expect(decryptFields).not.toHaveBeenCalled()
      expect(IntegrationMerger.merge).toHaveBeenCalledWith(null, null)
    })

    it('decrypts and merges both documents when both exist', async () => {
      const encryptedAppWide = {userId: 'user-1', workflowId: null, openai: {apiKey: 'enc-app-key'}}
      const encryptedWorkflow = {userId: 'user-1', workflowId: 'wf-1', openai: {apiKey: 'enc-wf-key'}}
      const decryptedAppWide = {userId: 'user-1', workflowId: null, openai: {apiKey: 'app-key'}}
      const decryptedWorkflow = {userId: 'user-1', workflowId: 'wf-1', openai: {apiKey: 'wf-key'}}
      const merged = {userId: 'user-1', workflowId: 'wf-1', openai: {apiKey: 'wf-key'}}

      IntegrationRepository.findBothDocs.mockResolvedValue({appWide: encryptedAppWide, workflow: encryptedWorkflow})
      decryptFields.mockReturnValueOnce(decryptedAppWide).mockReturnValueOnce(decryptedWorkflow)
      IntegrationMerger.merge.mockReturnValue(merged)

      const result = await IntegrationFacade.findDecrypted('user-1', 'wf-1')

      expect(result).toEqual(merged)
      expect(decryptFields).toHaveBeenCalledTimes(2)
      expect(decryptFields).toHaveBeenNthCalledWith(1, encryptedAppWide, expect.any(Object), {
        userId: 'user-1',
        workflowId: null,
      })
      expect(decryptFields).toHaveBeenNthCalledWith(2, encryptedWorkflow, expect.any(Object), {
        userId: 'user-1',
        workflowId: 'wf-1',
      })
      expect(IntegrationMerger.merge).toHaveBeenCalledWith(decryptedAppWide, decryptedWorkflow)
    })

    it('handles app-wide only (workflow is null)', async () => {
      const encryptedAppWide = {userId: 'user-1', workflowId: null, openai: {apiKey: 'enc-key'}}
      const decryptedAppWide = {userId: 'user-1', workflowId: null, openai: {apiKey: 'app-key'}}

      IntegrationRepository.findBothDocs.mockResolvedValue({appWide: encryptedAppWide, workflow: null})
      decryptFields.mockReturnValue(decryptedAppWide)
      IntegrationMerger.merge.mockReturnValue(decryptedAppWide)

      const result = await IntegrationFacade.findDecrypted('user-1')

      expect(result).toEqual(decryptedAppWide)
      expect(decryptFields).toHaveBeenCalledTimes(1)
      expect(IntegrationMerger.merge).toHaveBeenCalledWith(decryptedAppWide, null)
    })

    it('handles workflow only (app-wide is null)', async () => {
      const encryptedWorkflow = {userId: 'user-1', workflowId: 'wf-1', mcp: [{alias: '/qa'}]}
      const decryptedWorkflow = {userId: 'user-1', workflowId: 'wf-1', mcp: [{alias: '/qa'}]}

      IntegrationRepository.findBothDocs.mockResolvedValue({appWide: null, workflow: encryptedWorkflow})
      decryptFields.mockReturnValue(decryptedWorkflow)
      IntegrationMerger.merge.mockReturnValue(decryptedWorkflow)

      const result = await IntegrationFacade.findDecrypted('user-1', 'wf-1')

      expect(result).toEqual(decryptedWorkflow)
      expect(decryptFields).toHaveBeenCalledTimes(1)
      expect(IntegrationMerger.merge).toHaveBeenCalledWith(null, decryptedWorkflow)
    })

    it('delegates workflowId to repository', async () => {
      IntegrationRepository.findBothDocs.mockResolvedValue({appWide: null, workflow: null})

      await IntegrationFacade.findDecrypted('user-1', 'wf-123')

      expect(IntegrationRepository.findBothDocs).toHaveBeenCalledWith('user-1', 'wf-123')
    })

    it('propagates repository errors', async () => {
      IntegrationRepository.findBothDocs.mockRejectedValue(new Error('Connection timeout'))

      await expect(IntegrationFacade.findDecrypted('user-1')).rejects.toThrow('Connection timeout')
    })

    it('propagates decryption errors', async () => {
      IntegrationRepository.findBothDocs.mockResolvedValue({
        appWide: {userId: 'user-1'},
        workflow: null,
      })
      decryptFields.mockImplementation(() => {
        throw new Error('Decryption failed: invalid key')
      })

      await expect(IntegrationFacade.findDecrypted('user-1')).rejects.toThrow('Decryption failed: invalid key')
    })
  })

  describe('findDecryptedOrThrow', () => {
    it('throws when no integration found', async () => {
      IntegrationRepository.findBothDocs.mockResolvedValue({appWide: null, workflow: null})
      IntegrationMerger.merge.mockReturnValue(null)

      await expect(IntegrationFacade.findDecryptedOrThrow('user-1')).rejects.toThrow('Integration not found')
    })

    it('returns merged integration when found', async () => {
      const merged = {userId: 'user-1', openai: {apiKey: 'key'}}

      IntegrationRepository.findBothDocs.mockResolvedValue({
        appWide: {userId: 'user-1'},
        workflow: null,
      })
      decryptFields.mockReturnValue({userId: 'user-1'})
      IntegrationMerger.merge.mockReturnValue(merged)

      const result = await IntegrationFacade.findDecryptedOrThrow('user-1')

      expect(result).toEqual(merged)
    })

    it('propagates repository errors over "not found"', async () => {
      IntegrationRepository.findBothDocs.mockRejectedValue(new Error('Database unavailable'))

      await expect(IntegrationFacade.findDecryptedOrThrow('user-1')).rejects.toThrow('Database unavailable')
    })

    it('propagates decryption errors over "not found"', async () => {
      IntegrationRepository.findBothDocs.mockResolvedValue({
        appWide: {userId: 'user-1'},
        workflow: null,
      })
      decryptFields.mockImplementation(() => {
        throw new Error('Invalid encryption key')
      })

      await expect(IntegrationFacade.findDecryptedOrThrow('user-1')).rejects.toThrow('Invalid encryption key')
    })
  })

  describe('encryption configuration', () => {
    it('decrypts app-wide with null workflowId context', async () => {
      const appWide = {userId: 'user-1', workflowId: null}
      IntegrationRepository.findBothDocs.mockResolvedValue({appWide, workflow: null})
      decryptFields.mockReturnValue(appWide)
      IntegrationMerger.merge.mockReturnValue(appWide)

      await IntegrationFacade.findDecrypted('user-1')

      expect(decryptFields).toHaveBeenCalledWith(
        appWide,
        expect.objectContaining({fields: expect.any(Array), arrayFields: expect.any(Object)}),
        {userId: 'user-1', workflowId: null},
      )
    })

    it('decrypts workflow with actual workflowId context', async () => {
      const workflow = {userId: 'user-1', workflowId: 'wf-123'}
      IntegrationRepository.findBothDocs.mockResolvedValue({appWide: null, workflow})
      decryptFields.mockReturnValue(workflow)
      IntegrationMerger.merge.mockReturnValue(workflow)

      await IntegrationFacade.findDecrypted('user-1', 'wf-123')

      expect(decryptFields).toHaveBeenCalledWith(
        workflow,
        expect.objectContaining({fields: expect.any(Array), arrayFields: expect.any(Object)}),
        {userId: 'user-1', workflowId: 'wf-123'},
      )
    })
  })
})

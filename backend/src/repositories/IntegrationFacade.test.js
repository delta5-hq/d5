import IntegrationFacade from './IntegrationFacade'
import IntegrationRepository from './IntegrationRepository'
import IntegrationMerger, {mergeIntegrations} from './IntegrationMerger'
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

  describe('findMergedDecrypted', () => {
    beforeEach(() => {
      IntegrationRepository.findByUser = jest.fn()
      IntegrationRepository.findByWorkflow = jest.fn()
    })

    it('returns global doc only when workflowId is null', async () => {
      const globalDoc = {userId: 'user-1', workflowId: null, openai: {apiKey: 'encrypted'}}
      const decrypted = {userId: 'user-1', workflowId: null, openai: {apiKey: 'sk-key'}}

      IntegrationRepository.findBothDocs.mockResolvedValue({appWide: globalDoc, workflow: null})
      decryptFields.mockReturnValue(decrypted)
      IntegrationMerger.merge.mockReturnValue(decrypted)

      const result = await IntegrationFacade.findMergedDecrypted('user-1', null)

      expect(result).toEqual(decrypted)
      expect(IntegrationRepository.findBothDocs).toHaveBeenCalledWith('user-1', null)
      expect(IntegrationRepository.findByUser).not.toHaveBeenCalled()
      expect(IntegrationRepository.findByWorkflow).not.toHaveBeenCalled()
    })

    it('returns global doc only when workflowId is undefined', async () => {
      const globalDoc = {userId: 'user-1', workflowId: null, openai: {apiKey: 'encrypted'}}
      const decrypted = {userId: 'user-1', workflowId: null, openai: {apiKey: 'sk-key'}}

      IntegrationRepository.findBothDocs.mockResolvedValue({appWide: globalDoc, workflow: null})
      decryptFields.mockReturnValue(decrypted)
      IntegrationMerger.merge.mockReturnValue(decrypted)

      const result = await IntegrationFacade.findMergedDecrypted('user-1')

      expect(result).toEqual(decrypted)
    })

    it('fetches and decrypts both docs with correct AAD when workflowId is set', async () => {
      const globalDoc = {userId: 'user-1', workflowId: null, openai: {apiKey: 'g-enc'}}
      const workflowDoc = {userId: 'user-1', workflowId: 'wf-1', claude: {apiKey: 'w-enc'}}
      const decryptedGlobal = {userId: 'user-1', workflowId: null, openai: {apiKey: 'g-key'}}
      const decryptedWorkflow = {userId: 'user-1', workflowId: 'wf-1', claude: {apiKey: 'w-key'}}

      IntegrationRepository.findByUser.mockResolvedValue(globalDoc)
      IntegrationRepository.findByWorkflow.mockResolvedValue(workflowDoc)
      decryptFields.mockReturnValueOnce(decryptedGlobal).mockReturnValueOnce(decryptedWorkflow)
      mergeIntegrations.mockReturnValue({
        ...decryptedGlobal,
        ...decryptedWorkflow,
        openai: {apiKey: 'g-key'},
        claude: {apiKey: 'w-key'},
      })

      const result = await IntegrationFacade.findMergedDecrypted('user-1', 'wf-1')

      expect(IntegrationRepository.findByUser).toHaveBeenCalledWith('user-1')
      expect(IntegrationRepository.findByWorkflow).toHaveBeenCalledWith('user-1', 'wf-1')
      expect(decryptFields).toHaveBeenCalledWith(globalDoc, expect.any(Object), {
        userId: 'user-1',
        workflowId: null,
      })
      expect(decryptFields).toHaveBeenCalledWith(workflowDoc, expect.any(Object), {
        userId: 'user-1',
        workflowId: 'wf-1',
      })
      expect(result.openai).toEqual({apiKey: 'g-key'})
      expect(result.claude).toEqual({apiKey: 'w-key'})
    })

    it('returns null when both docs are absent', async () => {
      IntegrationRepository.findByUser.mockResolvedValue(null)
      IntegrationRepository.findByWorkflow.mockResolvedValue(null)
      mergeIntegrations.mockReturnValue(null)

      const result = await IntegrationFacade.findMergedDecrypted('user-1', 'wf-1')

      expect(result).toBeNull()
      expect(decryptFields).not.toHaveBeenCalled()
    })

    it('returns workflow doc when global is absent', async () => {
      const workflowDoc = {userId: 'user-1', workflowId: 'wf-1', openai: {apiKey: 'w-enc'}}
      const decryptedWorkflow = {userId: 'user-1', workflowId: 'wf-1', openai: {apiKey: 'w-key'}}

      IntegrationRepository.findByUser.mockResolvedValue(null)
      IntegrationRepository.findByWorkflow.mockResolvedValue(workflowDoc)
      decryptFields.mockReturnValue(decryptedWorkflow)
      mergeIntegrations.mockReturnValue(decryptedWorkflow)

      const result = await IntegrationFacade.findMergedDecrypted('user-1', 'wf-1')

      expect(result).toEqual(decryptedWorkflow)
    })

    it('returns global doc when workflow is absent', async () => {
      const globalDoc = {userId: 'user-1', workflowId: null, openai: {apiKey: 'g-enc'}}
      const decryptedGlobal = {userId: 'user-1', workflowId: null, openai: {apiKey: 'g-key'}}

      IntegrationRepository.findByUser.mockResolvedValue(globalDoc)
      IntegrationRepository.findByWorkflow.mockResolvedValue(null)
      decryptFields.mockReturnValue(decryptedGlobal)
      mergeIntegrations.mockReturnValue(decryptedGlobal)

      const result = await IntegrationFacade.findMergedDecrypted('user-1', 'wf-1')

      expect(result).toEqual(decryptedGlobal)
    })

    it('merges scalar fields correctly', async () => {
      const globalDoc = {
        userId: 'user-1',
        workflowId: null,
        openai: {apiKey: 'g-enc'},
        lang: 'en',
      }
      const workflowDoc = {
        userId: 'user-1',
        workflowId: 'wf-1',
        claude: {apiKey: 'w-enc'},
      }
      const decryptedGlobal = {userId: 'user-1', workflowId: null, openai: {apiKey: 'g-key'}, lang: 'en'}
      const decryptedWorkflow = {userId: 'user-1', workflowId: 'wf-1', claude: {apiKey: 'w-key'}}

      IntegrationRepository.findByUser.mockResolvedValue(globalDoc)
      IntegrationRepository.findByWorkflow.mockResolvedValue(workflowDoc)
      decryptFields.mockReturnValueOnce(decryptedGlobal).mockReturnValueOnce(decryptedWorkflow)
      mergeIntegrations.mockReturnValue({
        openai: {apiKey: 'g-key'},
        claude: {apiKey: 'w-key'},
        lang: 'en',
      })

      const result = await IntegrationFacade.findMergedDecrypted('user-1', 'wf-1')

      expect(result.openai).toEqual({apiKey: 'g-key'})
      expect(result.claude).toEqual({apiKey: 'w-key'})
      expect(result.lang).toBe('en')
    })

    it('merges array fields correctly', async () => {
      const globalDoc = {
        userId: 'user-1',
        workflowId: null,
        mcp: [{alias: '/g'}],
      }
      const workflowDoc = {
        userId: 'user-1',
        workflowId: 'wf-1',
        mcp: [{alias: '/w'}],
      }

      IntegrationRepository.findByUser.mockResolvedValue(globalDoc)
      IntegrationRepository.findByWorkflow.mockResolvedValue(workflowDoc)
      decryptFields
        .mockReturnValueOnce({userId: 'user-1', workflowId: null, mcp: [{alias: '/g'}]})
        .mockReturnValueOnce({userId: 'user-1', workflowId: 'wf-1', mcp: [{alias: '/w'}]})
      mergeIntegrations.mockReturnValue({mcp: [{alias: '/g'}, {alias: '/w'}]})

      const result = await IntegrationFacade.findMergedDecrypted('user-1', 'wf-1')

      expect(result.mcp).toEqual([{alias: '/g'}, {alias: '/w'}])
    })

    it('handles sentinel values correctly', async () => {
      const globalDoc = {
        userId: 'user-1',
        workflowId: null,
        lang: 'en',
        model: 'gpt-4',
      }
      const workflowDoc = {
        userId: 'user-1',
        workflowId: 'wf-1',
        lang: 'none',
        model: 'auto',
      }

      IntegrationRepository.findByUser.mockResolvedValue(globalDoc)
      IntegrationRepository.findByWorkflow.mockResolvedValue(workflowDoc)
      decryptFields
        .mockReturnValueOnce({userId: 'user-1', workflowId: null, lang: 'en', model: 'gpt-4'})
        .mockReturnValueOnce({userId: 'user-1', workflowId: 'wf-1', lang: 'none', model: 'auto'})
      mergeIntegrations.mockReturnValue({lang: 'en', model: 'gpt-4'})

      const result = await IntegrationFacade.findMergedDecrypted('user-1', 'wf-1')

      expect(result.lang).toBe('en')
      expect(result.model).toBe('gpt-4')
    })
  })

  describe('findMergedDecryptedWithMetadata', () => {
    beforeEach(() => {
      IntegrationRepository.findByUser = jest.fn()
      IntegrationRepository.findByWorkflow = jest.fn()
    })

    it('returns merged and null workflowDoc when workflowId is null', async () => {
      const globalDoc = {userId: 'user-1', workflowId: null, openai: {apiKey: 'encrypted'}}
      const decrypted = {userId: 'user-1', workflowId: null, openai: {apiKey: 'sk-key'}}

      IntegrationRepository.findBothDocs.mockResolvedValue({appWide: globalDoc, workflow: null})
      decryptFields.mockReturnValue(decrypted)
      IntegrationMerger.merge.mockReturnValue(decrypted)

      const result = await IntegrationFacade.findMergedDecryptedWithMetadata('user-1', null)

      expect(result).toEqual({merged: decrypted, workflowDoc: null})
      expect(IntegrationRepository.findByUser).not.toHaveBeenCalled()
      expect(IntegrationRepository.findByWorkflow).not.toHaveBeenCalled()
    })

    it('returns merged and workflow doc when both exist', async () => {
      const globalDoc = {userId: 'user-1', workflowId: null, openai: {apiKey: 'g-enc'}}
      const workflowDoc = {userId: 'user-1', workflowId: 'wf-1', claude: {apiKey: 'w-enc'}}
      const decryptedGlobal = {userId: 'user-1', workflowId: null, openai: {apiKey: 'g-key'}}
      const decryptedWorkflow = {userId: 'user-1', workflowId: 'wf-1', claude: {apiKey: 'w-key'}}

      IntegrationRepository.findByUser.mockResolvedValue(globalDoc)
      IntegrationRepository.findByWorkflow.mockResolvedValue(workflowDoc)
      decryptFields.mockReturnValueOnce(decryptedGlobal).mockReturnValueOnce(decryptedWorkflow)
      mergeIntegrations.mockReturnValue({
        openai: {apiKey: 'g-key'},
        claude: {apiKey: 'w-key'},
      })

      const result = await IntegrationFacade.findMergedDecryptedWithMetadata('user-1', 'wf-1')

      expect(result.merged.openai).toEqual({apiKey: 'g-key'})
      expect(result.merged.claude).toEqual({apiKey: 'w-key'})
      expect(result.workflowDoc).toEqual(decryptedWorkflow)
    })

    it('returns merged and null workflowDoc when workflow is absent', async () => {
      const globalDoc = {userId: 'user-1', workflowId: null, openai: {apiKey: 'g-enc'}}
      const decryptedGlobal = {userId: 'user-1', workflowId: null, openai: {apiKey: 'g-key'}}

      IntegrationRepository.findByUser.mockResolvedValue(globalDoc)
      IntegrationRepository.findByWorkflow.mockResolvedValue(null)
      decryptFields.mockReturnValue(decryptedGlobal)
      mergeIntegrations.mockReturnValue(decryptedGlobal)

      const result = await IntegrationFacade.findMergedDecryptedWithMetadata('user-1', 'wf-1')

      expect(result.merged).toEqual(decryptedGlobal)
      expect(result.workflowDoc).toBeNull()
    })
  })
})

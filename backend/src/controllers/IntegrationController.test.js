import IntegrationController from './IntegrationController'
import IntegrationRepository from '../repositories/IntegrationRepository'
import IntegrationFacade from '../repositories/IntegrationFacade'
import Integration from '../models/Integration'
import LLMVector from '../models/LLMVector'
import {encryptFields} from '../models/utils/fieldEncryption'
import {INTEGRATION_ENCRYPTION_CONFIG} from '../models/Integration'
import AliasValidator from './commandExecutor/commands/aliases/AliasValidator'
import EffectiveAliasResolver from './commandExecutor/commands/aliases/EffectiveAliasResolver'

jest.mock('./commandExecutor/commands/aliases/AliasValidator', () => ({
  __esModule: true,
  default: {
    validateIntegrationArrays: jest.fn(),
    validateSubmittedAgainstEffective: jest.fn(),
  },
}))

jest.mock('./commandExecutor/commands/aliases/EffectiveAliasResolver', () => ({
  __esModule: true,
  default: {
    resolveOtherType: jest.fn().mockReturnValue([]),
  },
}))

jest.mock('../repositories/IntegrationRepository', () => ({
  findWithFallback: jest.fn(),
  findBothDocs: jest.fn(),
}))

jest.mock('../repositories/IntegrationFacade', () => ({
  __esModule: true,
  default: {
    findMergedDecrypted: jest.fn(),
  },
}))
jest.mock('../models/Integration', () => {
  const updateOne = jest.fn()
  const deleteOne = jest.fn()
  return {
    __esModule: true,
    default: {updateOne, deleteOne},
    INTEGRATION_ENCRYPTION_CONFIG: {fields: ['openai']},
  }
})
jest.mock('../repositories/IntegrationSessionRepository', () => ({
  __esModule: true,
  default: {
    findAllSessionsForUser: jest.fn().mockResolvedValue([]),
  },
}))
jest.mock('../models/LLMVector')
jest.mock('../models/utils/fieldEncryption', () => ({
  encryptFields: jest.fn(data => data),
  decryptFields: jest.fn(data => data),
}))

const createCtx = (overrides = {}) => ({
  state: {userId: 'user-1'},
  query: {},
  params: {},
  request: {json: jest.fn().mockResolvedValue({})},
  throw: jest.fn((code, message) => {
    const err = new Error(message)
    err.statusCode = code
    throw err
  }),
  body: null,
  ...overrides,
})

describe('IntegrationController', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getAll', () => {
    it('calls facade with normalized null when workflowId is missing', async () => {
      IntegrationFacade.findMergedDecrypted.mockResolvedValue({openai: {key: 'k'}})
      const ctx = createCtx()

      await IntegrationController.getAll(ctx)

      expect(IntegrationFacade.findMergedDecrypted).toHaveBeenCalledWith('user-1', null)
      expect(ctx.body).toEqual({openai: {key: 'k'}, rpc: [], mcp: [], secretsMeta: {}})
    })

    it('calls facade with normalized null when workflowId is empty string', async () => {
      IntegrationFacade.findMergedDecrypted.mockResolvedValue({openai: {key: 'k'}})
      const ctx = createCtx({query: {workflowId: ''}})

      await IntegrationController.getAll(ctx)

      expect(IntegrationFacade.findMergedDecrypted).toHaveBeenCalledWith('user-1', null)
    })

    it('calls facade with workflowId when provided', async () => {
      IntegrationFacade.findMergedDecrypted.mockResolvedValue({openai: {key: 'k'}})
      const ctx = createCtx({query: {workflowId: 'wf-123'}})

      await IntegrationController.getAll(ctx)

      expect(IntegrationFacade.findMergedDecrypted).toHaveBeenCalledWith('user-1', 'wf-123')
    })

    it('throws 404 when facade returns null', async () => {
      IntegrationFacade.findMergedDecrypted.mockResolvedValue(null)
      const ctx = createCtx()

      await expect(IntegrationController.getAll(ctx)).rejects.toThrow('Integration not found')
      expect(ctx.throw).toHaveBeenCalledWith(404, 'Integration not found')
    })

    it('returns merged integration data', async () => {
      const merged = {openai: {key: 'merged'}}
      IntegrationFacade.findMergedDecrypted.mockResolvedValue(merged)
      const ctx = createCtx()

      await IntegrationController.getAll(ctx)

      expect(ctx.body).toEqual({...merged, rpc: [], mcp: [], secretsMeta: {}})
    })

    it('handles workflow-specific integration retrieval', async () => {
      const workflowData = {userId: 'user-1', workflowId: 'wf-123', openai: {key: 'workflow-key'}}
      IntegrationFacade.findMergedDecrypted.mockResolvedValue(workflowData)
      const ctx = createCtx({query: {workflowId: 'wf-123'}})

      await IntegrationController.getAll(ctx)

      expect(IntegrationFacade.findMergedDecrypted).toHaveBeenCalledWith('user-1', 'wf-123')
      expect(ctx.body).toEqual({...workflowData, rpc: [], mcp: [], secretsMeta: {}})
    })

    it('handles integration with MCP and RPC fields', async () => {
      const integration = {
        openai: {key: 'k'},
        mcp: [{alias: '/coder1'}],
        rpc: [{alias: '/vm1'}],
      }
      IntegrationFacade.findMergedDecrypted.mockResolvedValue(integration)
      const ctx = createCtx()

      await IntegrationController.getAll(ctx)

      expect(ctx.body.mcp).toEqual([{alias: '/coder1', lastSessionId: null}])
      expect(ctx.body.rpc).toEqual([{alias: '/vm1', lastSessionId: null}])
    })

    it('attaches lastSessionId from session store to matching alias', async () => {
      const IntegrationSessionRepository = require('../repositories/IntegrationSessionRepository').default
      IntegrationSessionRepository.findAllSessionsForUser.mockResolvedValue([
        {alias: '/vm1', protocol: 'rpc', lastSessionId: 'sess-abc'},
      ])
      const integration = {mcp: [{alias: '/coder1'}], rpc: [{alias: '/vm1'}]}
      IntegrationFacade.findMergedDecrypted.mockResolvedValue(integration)
      const ctx = createCtx()

      await IntegrationController.getAll(ctx)

      expect(ctx.body.rpc).toEqual([{alias: '/vm1', lastSessionId: 'sess-abc'}])
      expect(ctx.body.mcp).toEqual([{alias: '/coder1', lastSessionId: null}])
    })
  })

  describe('updateService', () => {
    beforeEach(() => {
      LLMVector.findOne.mockResolvedValue(null)
      LLMVector.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(undefined),
        store: new Map(),
      }))
      Integration.updateOne.mockResolvedValue({})
    })

    it('persists with normalized null workflowId when missing from query', async () => {
      const ctx = createCtx({
        params: {service: 'openai'},
        request: {json: jest.fn().mockResolvedValue({apiKey: 'sk-123'})},
      })

      await IntegrationController.updateService(ctx)

      expect(Integration.updateOne).toHaveBeenCalledWith(
        {userId: 'user-1', workflowId: null},
        expect.objectContaining({$set: expect.objectContaining({userId: 'user-1', workflowId: null})}),
        {upsert: true},
      )
    })

    it('persists with normalized null workflowId when empty string in query', async () => {
      const ctx = createCtx({
        query: {workflowId: ''},
        params: {service: 'openai'},
        request: {json: jest.fn().mockResolvedValue({apiKey: 'sk-123'})},
      })

      await IntegrationController.updateService(ctx)

      expect(Integration.updateOne).toHaveBeenCalledWith(
        {userId: 'user-1', workflowId: null},
        expect.anything(),
        expect.anything(),
      )
    })

    it('persists with workflow-specific workflowId when provided', async () => {
      const ctx = createCtx({
        query: {workflowId: 'wf-456'},
        params: {service: 'openai'},
        request: {json: jest.fn().mockResolvedValue({apiKey: 'sk-123'})},
      })

      await IntegrationController.updateService(ctx)

      expect(Integration.updateOne).toHaveBeenCalledWith(
        {userId: 'user-1', workflowId: 'wf-456'},
        expect.objectContaining({$set: expect.objectContaining({workflowId: 'wf-456'})}),
        {upsert: true},
      )
    })

    it('throws 400 when request body is falsy', async () => {
      const ctx = createCtx({
        params: {service: 'openai'},
        request: {json: jest.fn().mockResolvedValue(null)},
      })

      await expect(IntegrationController.updateService(ctx)).rejects.toThrow()
      expect(ctx.throw).toHaveBeenCalledWith(400, 'Something is wrong with the provided data')
    })

    it('encrypts service data before persisting', async () => {
      const serviceData = {apiKey: 'sk-123'}
      encryptFields.mockReturnValue({openai: {apiKey: 'encrypted'}})
      const ctx = createCtx({
        params: {service: 'openai'},
        request: {json: jest.fn().mockResolvedValue(serviceData)},
      })

      await IntegrationController.updateService(ctx)

      expect(encryptFields).toHaveBeenCalledWith({openai: serviceData}, INTEGRATION_ENCRYPTION_CONFIG, {
        userId: 'user-1',
        workflowId: null,
      })
    })

    it('uses same normalized workflowId in both filter and update', async () => {
      const ctx = createCtx({
        query: {workflowId: 'wf-789'},
        params: {service: 'openai'},
        request: {json: jest.fn().mockResolvedValue({apiKey: 'sk-123'})},
      })

      await IntegrationController.updateService(ctx)

      const [filter, update] = Integration.updateOne.mock.calls[0]
      expect(filter.workflowId).toBe(update.$set.workflowId)
    })

    it('creates new LLMVector when none exists', async () => {
      LLMVector.findOne.mockResolvedValue(null)
      const mockSave = jest.fn()
      LLMVector.mockImplementation(() => ({
        save: mockSave,
        store: new Map(),
      }))

      const ctx = createCtx({
        params: {service: 'openai'},
        request: {json: jest.fn().mockResolvedValue({apiKey: 'sk-123'})},
      })

      await IntegrationController.updateService(ctx)

      expect(mockSave).toHaveBeenCalled()
    })

    it('updates existing LLMVector when service not in store', async () => {
      const mockSave = jest.fn()
      const existingVector = {
        save: mockSave,
        store: new Map([['claude', {}]]),
      }
      LLMVector.findOne.mockResolvedValue(existingVector)

      const ctx = createCtx({
        params: {service: 'openai'},
        request: {json: jest.fn().mockResolvedValue({apiKey: 'sk-123'})},
      })

      await IntegrationController.updateService(ctx)

      expect(existingVector.store.has('openai')).toBe(true)
      expect(mockSave).toHaveBeenCalled()
    })

    it('does not update LLMVector when service already in store', async () => {
      const mockSave = jest.fn()
      const existingVector = {
        save: mockSave,
        store: new Map([['openai', {}]]),
      }
      LLMVector.findOne.mockResolvedValue(existingVector)

      const ctx = createCtx({
        params: {service: 'openai'},
        request: {json: jest.fn().mockResolvedValue({apiKey: 'sk-123'})},
      })

      await IntegrationController.updateService(ctx)

      expect(mockSave).not.toHaveBeenCalled()
    })

    it('handles special characters in workflowId', async () => {
      const specialWorkflowId = 'wf-$pecial@2024'
      const ctx = createCtx({
        query: {workflowId: specialWorkflowId},
        params: {service: 'openai'},
        request: {json: jest.fn().mockResolvedValue({apiKey: 'sk-123'})},
      })

      await IntegrationController.updateService(ctx)

      const [filter] = Integration.updateOne.mock.calls[0]
      expect(filter.workflowId).toBe(specialWorkflowId)
    })

    it('returns LLMVector in response body', async () => {
      const mockVector = {userId: 'user-1', store: new Map()}
      LLMVector.findOne.mockResolvedValue(null)
      LLMVector.mockImplementation(() => ({
        ...mockVector,
        save: jest.fn(),
      }))

      const ctx = createCtx({
        params: {service: 'openai'},
        request: {json: jest.fn().mockResolvedValue({apiKey: 'sk-123'})},
      })

      await IntegrationController.updateService(ctx)

      expect(ctx.body).toHaveProperty('vectors')
    })

    describe('alias validation for MCP/RPC', () => {
      const bothDocs = {appWide: {mcp: [], rpc: []}, workflow: null}
      const effectiveOpposite = [{alias: '/existing-opposite'}]

      beforeEach(() => {
        IntegrationRepository.findBothDocs.mockResolvedValue(bothDocs)
        EffectiveAliasResolver.resolveOtherType.mockReturnValue(effectiveOpposite)
      })

      it.each([
        ['mcp', [{alias: '/agent1'}, {alias: '/agent2'}]],
        ['rpc', [{alias: '/ssh1'}]],
      ])('service=%s: delegates to findBothDocs with correct userId and workflowId', async (service, integrations) => {
        const ctx = createCtx({
          params: {service},
          request: {json: jest.fn().mockResolvedValue(integrations)},
        })

        await IntegrationController.updateService(ctx)

        expect(IntegrationRepository.findBothDocs).toHaveBeenCalledWith('user-1', null)
      })

      it.each([
        ['mcp', [{alias: '/agent1'}]],
        ['rpc', [{alias: '/ssh1'}]],
      ])(
        'service=%s: delegates to EffectiveAliasResolver with correct service and docs',
        async (service, integrations) => {
          const ctx = createCtx({
            params: {service},
            request: {json: jest.fn().mockResolvedValue(integrations)},
          })

          await IntegrationController.updateService(ctx)

          expect(EffectiveAliasResolver.resolveOtherType).toHaveBeenCalledWith(service, bothDocs)
        },
      )

      it.each([
        ['mcp', [{alias: '/agent1'}]],
        ['rpc', [{alias: '/ssh1'}]],
      ])(
        'service=%s: delegates to validateSubmittedAgainstEffective with submitted array, service, and effective opposite',
        async (service, integrations) => {
          const ctx = createCtx({
            params: {service},
            request: {json: jest.fn().mockResolvedValue(integrations)},
          })

          await IntegrationController.updateService(ctx)

          expect(AliasValidator.validateSubmittedAgainstEffective).toHaveBeenCalledWith(
            integrations,
            service,
            effectiveOpposite,
          )
        },
      )

      it('passes workflow-scoped workflowId to findBothDocs when provided in query', async () => {
        const ctx = createCtx({
          query: {workflowId: 'wf-123'},
          params: {service: 'mcp'},
          request: {json: jest.fn().mockResolvedValue([{alias: '/agent'}])},
        })

        await IntegrationController.updateService(ctx)

        expect(IntegrationRepository.findBothDocs).toHaveBeenCalledWith('user-1', 'wf-123')
      })

      it.each([
        ['RESERVED_COMMAND', 'Alias conflicts with built-in', 'mcp'],
        ['DUPLICATE_IN_ARRAY', 'Duplicate alias found', 'mcp'],
        ['DUPLICATE_ACROSS_TYPES', 'Alias already in use by another integration', 'rpc'],
        ['RESERVED_COMMAND', 'Alias conflicts with built-in', 'rpc'],
      ])('AliasValidationError code=%s converts to HTTP 400 for service=%s', async (code, message, service) => {
        const {AliasValidationError} = jest.requireActual('./commandExecutor/commands/aliases/AliasValidator')
        AliasValidator.validateSubmittedAgainstEffective.mockImplementation(() => {
          throw new AliasValidationError(message, code, '/any')
        })

        const ctx = createCtx({
          params: {service},
          request: {json: jest.fn().mockResolvedValue([{alias: '/any'}])},
        })

        await expect(IntegrationController.updateService(ctx)).rejects.toThrow(message)
      })

      it('non-AliasValidationError propagates without converting to 400', async () => {
        const dbError = new Error('Database connection failed')
        AliasValidator.validateSubmittedAgainstEffective.mockImplementation(() => {
          throw dbError
        })

        const ctx = createCtx({
          params: {service: 'mcp'},
          request: {json: jest.fn().mockResolvedValue([{alias: '/valid'}])},
        })

        await expect(IntegrationController.updateService(ctx)).rejects.toThrow('Database connection failed')
      })

      it('does not call findBothDocs or validateSubmittedAgainstEffective for non-alias services', async () => {
        const ctx = createCtx({
          params: {service: 'openai'},
          request: {json: jest.fn().mockResolvedValue({apiKey: 'sk-123'})},
        })

        await IntegrationController.updateService(ctx)

        expect(IntegrationRepository.findBothDocs).not.toHaveBeenCalled()
        expect(AliasValidator.validateSubmittedAgainstEffective).not.toHaveBeenCalled()
      })
    })
  })

  describe('deleteIntegration', () => {
    it('deletes user-level integration when workflowId is not provided', async () => {
      const ctx = createCtx({query: {}})

      await IntegrationController.deleteIntegration(ctx)

      expect(Integration.deleteOne).toHaveBeenCalledWith({userId: 'user-1', workflowId: null})
      expect(ctx.status).toBe(204)
      expect(ctx.body).toBeNull()
    })

    it('deletes workflow-scoped integration when workflowId is provided', async () => {
      const ctx = createCtx({query: {workflowId: 'workflow-123'}})

      await IntegrationController.deleteIntegration(ctx)

      expect(Integration.deleteOne).toHaveBeenCalledWith({userId: 'user-1', workflowId: 'workflow-123'})
      expect(ctx.status).toBe(204)
      expect(ctx.body).toBeNull()
    })

    it('normalizes empty workflowId to null', async () => {
      const ctx = createCtx({query: {workflowId: ''}})

      await IntegrationController.deleteIntegration(ctx)

      expect(Integration.deleteOne).toHaveBeenCalledWith({userId: 'user-1', workflowId: null})
    })
  })

  describe('setLanguage', () => {
    beforeEach(() => {
      Integration.updateOne.mockResolvedValue({})
    })

    it('persists with normalized null workflowId when missing from body', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue(null)
      const ctx = createCtx({
        request: {json: jest.fn().mockResolvedValue({lang: 'en'})},
      })

      await IntegrationController.setLanguage(ctx)

      expect(IntegrationRepository.findWithFallback).toHaveBeenCalledWith('user-1', null)
      expect(Integration.updateOne).toHaveBeenCalledWith(
        {userId: 'user-1', workflowId: null},
        {$set: {userId: 'user-1', workflowId: null, lang: 'en'}},
        {upsert: true},
      )
      expect(ctx.body).toEqual({lang: 'en'})
    })

    it('persists with normalized null workflowId when empty string in body', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue(null)
      const ctx = createCtx({
        request: {json: jest.fn().mockResolvedValue({lang: 'en', workflowId: ''})},
      })

      await IntegrationController.setLanguage(ctx)

      expect(IntegrationRepository.findWithFallback).toHaveBeenCalledWith('user-1', null)
      expect(Integration.updateOne).toHaveBeenCalledWith(
        {userId: 'user-1', workflowId: null},
        expect.anything(),
        expect.anything(),
      )
    })

    it('persists with workflow-specific workflowId when provided', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue(null)
      const ctx = createCtx({
        request: {json: jest.fn().mockResolvedValue({lang: 'en', workflowId: 'wf-123'})},
      })

      await IntegrationController.setLanguage(ctx)

      expect(IntegrationRepository.findWithFallback).toHaveBeenCalledWith('user-1', 'wf-123')
      expect(Integration.updateOne).toHaveBeenCalledWith(
        {userId: 'user-1', workflowId: 'wf-123'},
        {$set: {userId: 'user-1', workflowId: 'wf-123', lang: 'en'}},
        {upsert: true},
      )
    })

    it('uses same normalized workflowId in both findWithFallback and updateOne', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue(null)
      const ctx = createCtx({
        request: {json: jest.fn().mockResolvedValue({lang: 'en', workflowId: 'wf-789'})},
      })

      await IntegrationController.setLanguage(ctx)

      const findCall = IntegrationRepository.findWithFallback.mock.calls[0]
      const [filter] = Integration.updateOne.mock.calls[0]
      expect(findCall[1]).toBe(filter.workflowId)
    })

    it('upserts when no existing integration found', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue(null)
      const ctx = createCtx({
        request: {json: jest.fn().mockResolvedValue({lang: 'ru', workflowId: null})},
      })

      await IntegrationController.setLanguage(ctx)

      expect(Integration.updateOne).toHaveBeenCalledWith(expect.anything(), expect.anything(), {upsert: true})
    })

    it('upserts when existing integration has different language', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue({lang: 'en'})
      const ctx = createCtx({
        request: {json: jest.fn().mockResolvedValue({lang: 'ru', workflowId: null})},
      })

      await IntegrationController.setLanguage(ctx)

      expect(Integration.updateOne).toHaveBeenCalledWith(
        {userId: 'user-1', workflowId: null},
        {$set: {userId: 'user-1', workflowId: null, lang: 'ru'}},
        {upsert: true},
      )
    })

    it('skips database write when existing integration has same language', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue({lang: 'en'})
      const ctx = createCtx({
        request: {json: jest.fn().mockResolvedValue({lang: 'en', workflowId: null})},
      })

      await IntegrationController.setLanguage(ctx)

      expect(Integration.updateOne).not.toHaveBeenCalled()
      expect(ctx.body).toEqual({lang: 'en'})
    })

    it('accepts USER_DEFAULT_LANGUAGE without validation', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue(null)
      const ctx = createCtx({
        request: {json: jest.fn().mockResolvedValue({lang: 'none', workflowId: null})},
      })

      await IntegrationController.setLanguage(ctx)

      expect(Integration.updateOne).toHaveBeenCalled()
    })

    it('returns the requested language in response body regardless of persistence', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue({lang: 'en'})
      const ctx = createCtx({
        request: {json: jest.fn().mockResolvedValue({lang: 'en', workflowId: null})},
      })

      await IntegrationController.setLanguage(ctx)

      expect(ctx.body).toEqual({lang: 'en'})
    })
  })

  describe('setModel', () => {
    beforeEach(() => {
      Integration.updateOne.mockResolvedValue({})
    })

    it('persists with normalized null workflowId when missing from body', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue(null)
      const ctx = createCtx({
        request: {json: jest.fn().mockResolvedValue({model: 'OpenAI'})},
      })

      await IntegrationController.setModel(ctx)

      expect(IntegrationRepository.findWithFallback).toHaveBeenCalledWith('user-1', null)
      expect(Integration.updateOne).toHaveBeenCalledWith(
        {userId: 'user-1', workflowId: null},
        {$set: {userId: 'user-1', workflowId: null, model: 'OpenAI'}},
        {upsert: true},
      )
      expect(ctx.body).toEqual({model: 'OpenAI'})
    })

    it('persists with normalized null workflowId when empty string in body', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue(null)
      const ctx = createCtx({
        request: {json: jest.fn().mockResolvedValue({model: 'OpenAI', workflowId: ''})},
      })

      await IntegrationController.setModel(ctx)

      expect(IntegrationRepository.findWithFallback).toHaveBeenCalledWith('user-1', null)
      expect(Integration.updateOne).toHaveBeenCalledWith(
        {userId: 'user-1', workflowId: null},
        expect.anything(),
        expect.anything(),
      )
    })

    it('persists with workflow-specific workflowId when provided', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue(null)
      const ctx = createCtx({
        request: {json: jest.fn().mockResolvedValue({model: 'OpenAI', workflowId: 'wf-456'})},
      })

      await IntegrationController.setModel(ctx)

      expect(IntegrationRepository.findWithFallback).toHaveBeenCalledWith('user-1', 'wf-456')
      expect(Integration.updateOne).toHaveBeenCalledWith(
        {userId: 'user-1', workflowId: 'wf-456'},
        {$set: {userId: 'user-1', workflowId: 'wf-456', model: 'OpenAI'}},
        {upsert: true},
      )
    })

    it('uses same normalized workflowId in both findWithFallback and updateOne', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue(null)
      const ctx = createCtx({
        request: {json: jest.fn().mockResolvedValue({model: 'OpenAI', workflowId: 'wf-789'})},
      })

      await IntegrationController.setModel(ctx)

      const findCall = IntegrationRepository.findWithFallback.mock.calls[0]
      const [filter] = Integration.updateOne.mock.calls[0]
      expect(findCall[1]).toBe(filter.workflowId)
    })

    it('upserts when no existing integration found', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue(null)
      const ctx = createCtx({
        request: {json: jest.fn().mockResolvedValue({model: 'Claude', workflowId: null})},
      })

      await IntegrationController.setModel(ctx)

      expect(Integration.updateOne).toHaveBeenCalledWith(expect.anything(), expect.anything(), {upsert: true})
    })

    it('upserts when existing integration has different model', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue({model: 'YandexGPT'})
      const ctx = createCtx({
        request: {json: jest.fn().mockResolvedValue({model: 'OpenAI', workflowId: null})},
      })

      await IntegrationController.setModel(ctx)

      expect(Integration.updateOne).toHaveBeenCalledWith(
        {userId: 'user-1', workflowId: null},
        {$set: {userId: 'user-1', workflowId: null, model: 'OpenAI'}},
        {upsert: true},
      )
    })

    it('skips database write when existing integration has same model', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue({model: 'OpenAI'})
      const ctx = createCtx({
        request: {json: jest.fn().mockResolvedValue({model: 'OpenAI', workflowId: null})},
      })

      await IntegrationController.setModel(ctx)

      expect(Integration.updateOne).not.toHaveBeenCalled()
      expect(ctx.body).toEqual({model: 'OpenAI'})
    })

    it('accepts USER_DEFAULT_MODEL without validation', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue(null)
      const ctx = createCtx({
        request: {json: jest.fn().mockResolvedValue({model: 'auto', workflowId: null})},
      })

      await IntegrationController.setModel(ctx)

      expect(Integration.updateOne).toHaveBeenCalled()
    })

    it('accepts any model from MODELS list', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue(null)

      for (const model of ['OpenAI', 'YandexGPT', 'Claude', 'Qwen', 'Deepseek', 'CustomLLM']) {
        Integration.updateOne.mockClear()
        const ctx = createCtx({
          request: {json: jest.fn().mockResolvedValue({model, workflowId: null})},
        })

        await IntegrationController.setModel(ctx)

        expect(Integration.updateOne).toHaveBeenCalled()
      }
    })

    it('silently skips persistence for models not in MODELS list and not USER_DEFAULT_MODEL', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue(null)
      const ctx = createCtx({
        request: {json: jest.fn().mockResolvedValue({model: 'InvalidModel', workflowId: null})},
      })

      await IntegrationController.setModel(ctx)

      expect(Integration.updateOne).not.toHaveBeenCalled()
      expect(ctx.body).toEqual({model: 'InvalidModel'})
    })

    it('returns the requested model in response body regardless of persistence', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue({model: 'OpenAI'})
      const ctx = createCtx({
        request: {json: jest.fn().mockResolvedValue({model: 'OpenAI', workflowId: null})},
      })

      await IntegrationController.setModel(ctx)

      expect(ctx.body).toEqual({model: 'OpenAI'})
    })
  })
})

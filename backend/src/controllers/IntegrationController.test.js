import IntegrationController from './IntegrationController'
import IntegrationRepository from '../repositories/IntegrationRepository'
import Integration from '../models/Integration'
import LLMVector from '../models/LLMVector'
import {encryptFields, decryptFields} from '../models/utils/fieldEncryption'
import {INTEGRATION_ENCRYPTION_CONFIG} from '../models/Integration'
import AliasValidator from './commandExecutor/commands/aliases/AliasValidator'

jest.mock('./commandExecutor/commands/aliases/AliasValidator', () => ({
  __esModule: true,
  default: {
    validateIntegrationArrays: jest.fn(),
  },
}))

jest.mock('../repositories/IntegrationRepository', () => ({
  findWithFallback: jest.fn(),
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
    it('calls repository with normalized null when workflowId is missing', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue({openai: {key: 'k'}})
      const ctx = createCtx()

      await IntegrationController.getAll(ctx)

      expect(IntegrationRepository.findWithFallback).toHaveBeenCalledWith('user-1', null)
      expect(decryptFields).toHaveBeenCalled()
      expect(ctx.body).toEqual({openai: {key: 'k'}})
    })

    it('calls repository with normalized null when workflowId is empty string', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue({openai: {key: 'k'}})
      const ctx = createCtx({query: {workflowId: ''}})

      await IntegrationController.getAll(ctx)

      expect(IntegrationRepository.findWithFallback).toHaveBeenCalledWith('user-1', null)
    })

    it('calls repository with workflowId when provided', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue({openai: {key: 'k'}})
      const ctx = createCtx({query: {workflowId: 'wf-123'}})

      await IntegrationController.getAll(ctx)

      expect(IntegrationRepository.findWithFallback).toHaveBeenCalledWith('user-1', 'wf-123')
    })

    it('throws 404 when repository returns null', async () => {
      IntegrationRepository.findWithFallback.mockResolvedValue(null)
      const ctx = createCtx()

      await expect(IntegrationController.getAll(ctx)).rejects.toThrow('Integration not found')
      expect(ctx.throw).toHaveBeenCalledWith(404, 'Integration not found')
    })

    it('decrypts integration data before returning', async () => {
      const raw = {openai: {key: 'encrypted'}}
      const decrypted = {openai: {key: 'decrypted'}}
      IntegrationRepository.findWithFallback.mockResolvedValue(raw)
      decryptFields.mockReturnValue(decrypted)
      const ctx = createCtx()

      await IntegrationController.getAll(ctx)

      expect(decryptFields).toHaveBeenCalledWith(raw, INTEGRATION_ENCRYPTION_CONFIG, {
        userId: 'user-1',
        workflowId: raw.workflowId,
      })
      expect(ctx.body).toEqual(decrypted)
    })

    it('handles workflow-specific integration retrieval', async () => {
      const workflowData = {userId: 'user-1', workflowId: 'wf-123', openai: {key: 'workflow-key'}}
      IntegrationRepository.findWithFallback.mockResolvedValue(workflowData)
      decryptFields.mockReturnValueOnce(workflowData)
      const ctx = createCtx({query: {workflowId: 'wf-123'}})

      await IntegrationController.getAll(ctx)

      expect(IntegrationRepository.findWithFallback).toHaveBeenCalledWith('user-1', 'wf-123')
      expect(ctx.body).toEqual(workflowData)
    })

    it('handles integration with MCP and RPC fields', async () => {
      const integration = {
        openai: {key: 'k'},
        mcp: [{alias: '/coder1'}],
        rpc: [{alias: '/vm1'}],
      }
      IntegrationRepository.findWithFallback.mockResolvedValue(integration)
      decryptFields.mockReturnValueOnce(integration)
      const ctx = createCtx()

      await IntegrationController.getAll(ctx)

      expect(ctx.body.mcp).toEqual([{alias: '/coder1'}])
      expect(ctx.body.rpc).toEqual([{alias: '/vm1'}])
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
      beforeEach(() => {
        IntegrationRepository.findWithFallback.mockResolvedValue({
          mcp: [{alias: '/existing'}],
          rpc: [],
        })
      })

      it('validates MCP aliases when updating mcp service', async () => {
        const mcpIntegrations = [{alias: '/agent1'}, {alias: '/agent2'}]
        const ctx = createCtx({
          params: {service: 'mcp'},
          request: {json: jest.fn().mockResolvedValue(mcpIntegrations)},
        })

        await IntegrationController.updateService(ctx)

        expect(AliasValidator.validateIntegrationArrays).toHaveBeenCalledWith(mcpIntegrations, [])
      })

      it('validates RPC aliases when updating rpc service', async () => {
        const rpcIntegrations = [{alias: '/ssh1'}]
        const ctx = createCtx({
          params: {service: 'rpc'},
          request: {json: jest.fn().mockResolvedValue(rpcIntegrations)},
        })

        await IntegrationController.updateService(ctx)

        expect(AliasValidator.validateIntegrationArrays).toHaveBeenCalledWith([{alias: '/existing'}], rpcIntegrations)
      })

      it('rejects with 400 when MCP alias validation fails', async () => {
        const actualModule = jest.requireActual('./commandExecutor/commands/aliases/AliasValidator')
        AliasValidator.validateIntegrationArrays.mockImplementation(() => {
          throw new actualModule.AliasValidationError('Alias conflicts with built-in', 'RESERVED_COMMAND', '/web')
        })

        const ctx = createCtx({
          params: {service: 'mcp'},
          request: {json: jest.fn().mockResolvedValue([{alias: '/web'}])},
        })

        await expect(IntegrationController.updateService(ctx)).rejects.toThrow('Alias conflicts with built-in')
      })

      it('rejects with 400 when RPC alias validation fails', async () => {
        const actualModule = jest.requireActual('./commandExecutor/commands/aliases/AliasValidator')
        AliasValidator.validateIntegrationArrays.mockImplementation(() => {
          throw new actualModule.AliasValidationError('Duplicate alias found', 'DUPLICATE_IN_ARRAY', '/dup')
        })

        const ctx = createCtx({
          params: {service: 'rpc'},
          request: {json: jest.fn().mockResolvedValue([{alias: '/dup'}, {alias: '/dup'}])},
        })

        await expect(IntegrationController.updateService(ctx)).rejects.toThrow('Duplicate alias found')
      })

      it('does not validate when updating non-alias services', async () => {
        const ctx = createCtx({
          params: {service: 'openai'},
          request: {json: jest.fn().mockResolvedValue({apiKey: 'sk-123'})},
        })

        await IntegrationController.updateService(ctx)

        expect(AliasValidator.validateIntegrationArrays).not.toHaveBeenCalled()
      })

      it('throws non-validation errors unchanged', async () => {
        const otherError = new Error('Database connection failed')
        AliasValidator.validateIntegrationArrays.mockImplementation(() => {
          throw otherError
        })

        const ctx = createCtx({
          params: {service: 'mcp'},
          request: {json: jest.fn().mockResolvedValue([{alias: '/valid'}])},
        })

        await expect(IntegrationController.updateService(ctx)).rejects.toThrow('Database connection failed')
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
})

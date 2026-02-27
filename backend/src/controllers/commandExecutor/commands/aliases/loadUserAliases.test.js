import {loadUserAliases} from './loadUserAliases'
import {INTEGRATION_ENCRYPTION_CONFIG} from '../../../../models/Integration'
import {decryptFields} from '../../../../models/utils/fieldEncryption'
import IntegrationRepository from '../../../../repositories/IntegrationRepository'

jest.mock('../../../../repositories/IntegrationRepository', () => ({
  __esModule: true,
  default: {
    findWithFallback: jest.fn(),
  },
}))

jest.mock('../../../../models/Integration', () => ({
  __esModule: true,
  INTEGRATION_ENCRYPTION_CONFIG: {
    fields: [],
    arrayFields: {},
  },
}))

jest.mock('../../../../models/utils/fieldEncryption', () => ({
  decryptFields: jest.fn(data => data),
  encryptFields: jest.fn(data => data),
}))

jest.mock('./SessionHydrator', () => ({
  __esModule: true,
  default: {
    hydrateAll: jest.fn((userId, aliases) => Promise.resolve(aliases)),
  },
}))

describe('loadUserAliases', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns empty arrays when integration not found', async () => {
    IntegrationRepository.findWithFallback.mockResolvedValue(null)

    const result = await loadUserAliases('user-1')

    expect(result).toEqual({mcp: [], rpc: []})
    expect(IntegrationRepository.findWithFallback).toHaveBeenCalledWith('user-1', null)
  })

  it('returns empty arrays when mcp and rpc fields are absent', async () => {
    IntegrationRepository.findWithFallback.mockResolvedValue({userId: 'user-1'})

    const result = await loadUserAliases('user-1')

    expect(result).toEqual({mcp: [], rpc: []})
  })

  it('filters out invalid MCP aliases', async () => {
    IntegrationRepository.findWithFallback.mockResolvedValue({
      userId: 'user-1',
      mcp: [{alias: '/valid'}, {alias: 'no-slash'}, {alias: '/web'}, {alias: '/9starts-digit'}, {alias: '/has space'}],
    })

    const result = await loadUserAliases('user-1')

    expect(result.mcp).toEqual([{alias: '/valid'}])
  })

  it('filters out invalid RPC aliases', async () => {
    IntegrationRepository.findWithFallback.mockResolvedValue({
      userId: 'user-1',
      rpc: [{alias: '/vm1'}, {alias: '/chatgpt'}, {alias: ''}, {alias: '/ok-name_v2'}],
    })

    const result = await loadUserAliases('user-1')

    expect(result.rpc).toEqual([{alias: '/vm1'}, {alias: '/ok-name_v2'}])
  })

  it('returns both MCP and RPC aliases', async () => {
    const dbData = {
      userId: 'user-1',
      mcp: [{alias: '/coder1'}, {alias: '/agent2'}],
      rpc: [{alias: '/vm3'}, {alias: '/ssh1'}],
    }

    IntegrationRepository.findWithFallback.mockResolvedValue(dbData)

    const result = await loadUserAliases('user-1')

    expect(result).toEqual({
      mcp: [{alias: '/coder1'}, {alias: '/agent2'}],
      rpc: [{alias: '/vm3'}, {alias: '/ssh1'}],
    })
    expect(decryptFields).toHaveBeenCalledWith(dbData, INTEGRATION_ENCRYPTION_CONFIG)
  })

  it('propagates database errors', async () => {
    IntegrationRepository.findWithFallback.mockRejectedValue(new Error('DB connection lost'))

    await expect(loadUserAliases('user-1')).rejects.toThrow('DB connection lost')
  })

  it('accepts optional workflowId and passes to repository', async () => {
    const dbData = {
      userId: 'user-1',
      workflowId: 'wf-123',
      mcp: [{alias: '/workflow-specific'}],
    }

    IntegrationRepository.findWithFallback.mockResolvedValue(dbData)

    const result = await loadUserAliases('user-1', 'wf-123')

    expect(IntegrationRepository.findWithFallback).toHaveBeenCalledWith('user-1', 'wf-123')
    expect(result.mcp).toEqual([{alias: '/workflow-specific'}])
  })
})

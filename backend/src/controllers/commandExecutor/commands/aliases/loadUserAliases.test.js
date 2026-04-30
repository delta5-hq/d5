import {loadUserAliases} from './loadUserAliases'
import IntegrationFacade from '../../../../repositories/IntegrationFacade'

jest.mock('../../../../repositories/IntegrationFacade', () => ({
  __esModule: true,
  default: {
    findMergedDecrypted: jest.fn(),
  },
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
    IntegrationFacade.findMergedDecrypted.mockResolvedValue(null)

    const result = await loadUserAliases('user-1')

    expect(result).toEqual({mcp: [], rpc: []})
    expect(IntegrationFacade.findMergedDecrypted).toHaveBeenCalledWith('user-1', null)
  })

  it('returns empty arrays when mcp and rpc fields are absent', async () => {
    IntegrationFacade.findMergedDecrypted.mockResolvedValue({userId: 'user-1'})

    const result = await loadUserAliases('user-1')

    expect(result).toEqual({mcp: [], rpc: []})
  })

  it('filters out invalid MCP aliases', async () => {
    IntegrationFacade.findMergedDecrypted.mockResolvedValue({
      userId: 'user-1',
      mcp: [{alias: '/valid'}, {alias: 'no-slash'}, {alias: '/web'}, {alias: '/9starts-digit'}, {alias: '/has space'}],
    })

    const result = await loadUserAliases('user-1')

    expect(result.mcp).toEqual([{alias: '/valid'}])
  })

  it('filters out invalid RPC aliases', async () => {
    IntegrationFacade.findMergedDecrypted.mockResolvedValue({
      userId: 'user-1',
      rpc: [{alias: '/vm1'}, {alias: '/chatgpt'}, {alias: ''}, {alias: '/ok-name_v2'}],
    })

    const result = await loadUserAliases('user-1')

    expect(result.rpc).toEqual([{alias: '/vm1'}, {alias: '/ok-name_v2'}])
  })

  it('returns both MCP and RPC aliases', async () => {
    IntegrationFacade.findMergedDecrypted.mockResolvedValue({
      userId: 'user-1',
      mcp: [{alias: '/coder1'}, {alias: '/agent2'}],
      rpc: [{alias: '/vm3'}, {alias: '/ssh1'}],
    })

    const result = await loadUserAliases('user-1')

    expect(result).toEqual({
      mcp: [{alias: '/coder1'}, {alias: '/agent2'}],
      rpc: [{alias: '/vm3'}, {alias: '/ssh1'}],
    })
  })

  it('propagates database errors', async () => {
    IntegrationFacade.findMergedDecrypted.mockRejectedValue(new Error('DB connection lost'))

    await expect(loadUserAliases('user-1')).rejects.toThrow('DB connection lost')
  })

  it('accepts optional workflowId and passes to facade', async () => {
    IntegrationFacade.findMergedDecrypted.mockResolvedValue({
      userId: 'user-1',
      workflowId: 'wf-123',
      mcp: [{alias: '/workflow-specific'}],
    })

    const result = await loadUserAliases('user-1', 'wf-123')

    expect(IntegrationFacade.findMergedDecrypted).toHaveBeenCalledWith('user-1', 'wf-123')
    expect(result.mcp).toEqual([{alias: '/workflow-specific'}])
  })

  describe('workflow-scoped alias merging', () => {
    it('processes merged result from findMergedDecrypted', async () => {
      IntegrationFacade.findMergedDecrypted.mockResolvedValue({
        userId: 'user-1',
        workflowId: 'wf-1',
        mcp: [{alias: '/global'}, {alias: '/workflow-specific'}],
        rpc: [{alias: '/vm'}],
      })

      const result = await loadUserAliases('user-1', 'wf-1')

      expect(result.mcp).toEqual([{alias: '/global'}, {alias: '/workflow-specific'}])
      expect(result.rpc).toEqual([{alias: '/vm'}])
    })

    it('filters invalid aliases from merged result', async () => {
      IntegrationFacade.findMergedDecrypted.mockResolvedValue({
        userId: 'user-1',
        workflowId: 'wf-1',
        mcp: [{alias: '/valid'}, {alias: 'invalid-no-slash'}],
        rpc: [{alias: '/chatgpt'}],
      })

      const result = await loadUserAliases('user-1', 'wf-1')

      expect(result.mcp).toEqual([{alias: '/valid'}])
      expect(result.rpc).toEqual([])
    })
  })
})

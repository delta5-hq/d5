import {loadUserAliases} from './loadUserAliases'
import Integration from '../../../../models/Integration'

jest.mock('../../../../models/Integration', () => ({
  findOne: jest.fn(),
}))

describe('loadUserAliases', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns empty arrays when integration not found', async () => {
    Integration.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    })

    const result = await loadUserAliases('user-1')

    expect(result).toEqual({mcp: [], rpc: []})
    expect(Integration.findOne).toHaveBeenCalledWith({userId: 'user-1'})
  })

  it('returns empty arrays when mcp and rpc fields are absent', async () => {
    Integration.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({userId: 'user-1'}),
    })

    const result = await loadUserAliases('user-1')

    expect(result).toEqual({mcp: [], rpc: []})
  })

  it('filters out invalid MCP aliases', async () => {
    Integration.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        userId: 'user-1',
        mcp: [
          {alias: '/valid'},
          {alias: 'no-slash'},
          {alias: '/web'},
          {alias: '/9starts-digit'},
          {alias: '/has space'},
        ],
      }),
    })

    const result = await loadUserAliases('user-1')

    expect(result.mcp).toEqual([{alias: '/valid'}])
  })

  it('filters out invalid RPC aliases', async () => {
    Integration.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        userId: 'user-1',
        rpc: [{alias: '/vm1'}, {alias: '/chatgpt'}, {alias: ''}, {alias: '/ok-name_v2'}],
      }),
    })

    const result = await loadUserAliases('user-1')

    expect(result.rpc).toEqual([{alias: '/vm1'}, {alias: '/ok-name_v2'}])
  })

  it('returns both MCP and RPC aliases', async () => {
    Integration.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        userId: 'user-1',
        mcp: [{alias: '/coder1'}, {alias: '/agent2'}],
        rpc: [{alias: '/vm3'}, {alias: '/ssh1'}],
      }),
    })

    const result = await loadUserAliases('user-1')

    expect(result).toEqual({
      mcp: [{alias: '/coder1'}, {alias: '/agent2'}],
      rpc: [{alias: '/vm3'}, {alias: '/ssh1'}],
    })
  })

  it('propagates database errors', async () => {
    Integration.findOne.mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error('DB connection lost')),
    })

    await expect(loadUserAliases('user-1')).rejects.toThrow('DB connection lost')
  })
})

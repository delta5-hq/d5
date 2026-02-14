import {loadMCPAliases, queryTypeFromAlias, findAliasByQueryType} from './aliasResolver'
import Integration from '../../../../models/Integration'

jest.mock('../../../../models/Integration', () => ({
  findOne: jest.fn(),
}))

const mkAlias = (alias, toolName = 'run') => ({
  alias,
  serverUrl: 'http://srv',
  transport: 'streamable-http',
  toolName,
})

describe('aliasResolver', () => {
  afterEach(() => jest.clearAllMocks())

  describe('loadMCPAliases', () => {
    it('returns empty array when user has no integration record', async () => {
      Integration.findOne.mockReturnValue({lean: () => null})

      expect(await loadMCPAliases('user-1')).toEqual([])
    })

    it('returns empty array when integration has no mcp field', async () => {
      Integration.findOne.mockReturnValue({lean: () => ({userId: 'user-1'})})

      expect(await loadMCPAliases('user-1')).toEqual([])
    })

    it('returns empty array when mcp array is empty', async () => {
      Integration.findOne.mockReturnValue({lean: () => ({userId: 'user-1', mcp: []})})

      expect(await loadMCPAliases('user-1')).toEqual([])
    })

    it('returns valid aliases from integration document', async () => {
      const aliases = [mkAlias('/myTool', 'run'), mkAlias('/other', 'search')]
      Integration.findOne.mockReturnValue({lean: () => ({userId: 'user-1', mcp: aliases})})

      expect(await loadMCPAliases('user-1')).toEqual(aliases)
    })

    it('propagates DB errors', async () => {
      Integration.findOne.mockImplementation(() => {
        throw new Error('DB connection lost')
      })

      await expect(loadMCPAliases('user-1')).rejects.toThrow('DB connection lost')
    })

    it('queries integration by userId', async () => {
      Integration.findOne.mockReturnValue({lean: () => null})

      await loadMCPAliases('specific-user')

      expect(Integration.findOne).toHaveBeenCalledWith({userId: 'specific-user'})
    })

    describe('alias validation', () => {
      it('rejects alias without leading slash', async () => {
        Integration.findOne.mockReturnValue({lean: () => ({mcp: [mkAlias('noSlash')]})})

        expect(await loadMCPAliases('u')).toEqual([])
      })

      it('rejects empty alias string', async () => {
        Integration.findOne.mockReturnValue({lean: () => ({mcp: [mkAlias('')]})})

        expect(await loadMCPAliases('u')).toEqual([])
      })

      it('rejects slash-only alias', async () => {
        Integration.findOne.mockReturnValue({lean: () => ({mcp: [mkAlias('/')]})})

        expect(await loadMCPAliases('u')).toEqual([])
      })

      it.each(['/chatgpt', '/web', '/steps', '/foreach', '/claude', '/deepseek'])(
        'rejects built-in command collision: %s',
        async alias => {
          Integration.findOne.mockReturnValue({lean: () => ({mcp: [mkAlias(alias)]})})

          expect(await loadMCPAliases('u')).toEqual([])
        },
      )

      it.each(['/has spaces', '/has.dot', '/123numeric', '/special!char', '/tàb'])(
        'rejects invalid characters: %s',
        async alias => {
          Integration.findOne.mockReturnValue({lean: () => ({mcp: [mkAlias(alias)]})})

          expect(await loadMCPAliases('u')).toEqual([])
        },
      )

      it.each(['/my-tool', '/my_tool', '/A1-b2_c3', '/camelCase', '/x'])('accepts valid alias: %s', async alias => {
        const entry = mkAlias(alias)
        Integration.findOne.mockReturnValue({lean: () => ({mcp: [entry]})})

        expect(await loadMCPAliases('u')).toEqual([entry])
      })

      it('filters mixed valid and invalid aliases', async () => {
        const valid = mkAlias('/good')
        const invalid = mkAlias('/chatgpt')
        Integration.findOne.mockReturnValue({lean: () => ({mcp: [valid, invalid]})})

        expect(await loadMCPAliases('u')).toEqual([valid])
      })
    })
  })

  describe('queryTypeFromAlias', () => {
    it.each([
      ['/coder1', 'mcp:coder1'],
      ['coder1', 'mcp:coder1'],
      ['/agent-farm_v2', 'mcp:agent-farm_v2'],
      ['/x', 'mcp:x'],
    ])('maps %s → %s', (input, expected) => {
      expect(queryTypeFromAlias(input)).toBe(expected)
    })
  })

  describe('findAliasByQueryType', () => {
    const aliases = [mkAlias('/toolA', 'a'), mkAlias('/toolB', 'b')]

    it('returns matching alias config', () => {
      expect(findAliasByQueryType(aliases, 'mcp:toolA')).toEqual(aliases[0])
    })

    it('returns second alias when it matches', () => {
      expect(findAliasByQueryType(aliases, 'mcp:toolB')).toEqual(aliases[1])
    })

    it('returns undefined for non-existent queryType', () => {
      expect(findAliasByQueryType(aliases, 'mcp:nonexistent')).toBeUndefined()
    })

    it('returns undefined for built-in queryType format', () => {
      expect(findAliasByQueryType(aliases, 'chat')).toBeUndefined()
    })

    it('returns undefined for empty aliases array', () => {
      expect(findAliasByQueryType([], 'mcp:toolA')).toBeUndefined()
    })
  })
})

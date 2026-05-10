import {AliasValidator, AliasValidationError} from './AliasValidator'

describe('AliasValidator', () => {
  let validator

  beforeEach(() => {
    validator = new AliasValidator()
  })

  describe('validateFormat', () => {
    it('accepts a valid alias', () => {
      expect(() => validator.validateFormat('/valid-alias_v2')).not.toThrow()
    })
    it('throws AliasValidationError for invalid input', () => {
      expect(() => validator.validateFormat('noSlash')).toThrow(expect.objectContaining({code: 'MISSING_SLASH'}))
      expect(() => validator.validateFormat('/1invalid')).toThrow(expect.objectContaining({code: 'INVALID_CHARACTERS'}))
      expect(() => validator.validateFormat(null)).toThrow(expect.objectContaining({code: 'INVALID_FORMAT'}))
    })
  })

  describe('validateNotBuiltIn', () => {
    it('accepts a non-reserved alias', () => {
      expect(() => validator.validateNotBuiltIn('/myCustomAgent')).not.toThrow()
    })
    it('throws AliasValidationError for built-in command', () => {
      expect(() => validator.validateNotBuiltIn('/web')).toThrow(AliasValidationError)
      expect(() => validator.validateNotBuiltIn('/web')).toThrow(expect.objectContaining({code: 'RESERVED_COMMAND'}))
    })
  })

  describe('validateNoDuplicatesInArray', () => {
    describe('accepts arrays without duplicates', () => {
      it.each([
        [[], 'empty array'],
        [[{alias: '/agent1'}], 'single entry'],
        [[{alias: '/agent1'}, {alias: '/agent2'}], 'two unique entries'],
        [[{alias: '/a'}, {alias: '/b'}, {alias: '/c'}, {alias: '/d'}], 'multiple unique entries'],
        [[{alias: '/agent'}, {alias: '/Agent'}], 'case-sensitive uniqueness'],
      ])('%s', aliases => {
        expect(() => validator.validateNoDuplicatesInArray(aliases, 'MCP')).not.toThrow()
      })
    })

    describe('rejects arrays with duplicates', () => {
      it.each([
        [[{alias: '/dup'}, {alias: '/dup'}], 'two identical'],
        [[{alias: '/a'}, {alias: '/b'}, {alias: '/a'}], 'duplicate at start and end'],
        [[{alias: '/x'}, {alias: '/x'}, {alias: '/x'}], 'three identical'],
        [[{alias: '/a'}, {alias: '/b'}, {alias: '/c'}, {alias: '/b'}], 'duplicate in middle'],
      ])('%s', aliases => {
        expect(() => validator.validateNoDuplicatesInArray(aliases, 'MCP')).toThrow(AliasValidationError)
        expect(() => validator.validateNoDuplicatesInArray(aliases, 'MCP')).toThrow('Duplicate alias')
        expect(() => validator.validateNoDuplicatesInArray(aliases, 'MCP')).toThrow(
          expect.objectContaining({code: 'DUPLICATE_IN_ARRAY'}),
        )
      })
    })

    it('includes integration type in error message', () => {
      const aliases = [{alias: '/dup'}, {alias: '/dup'}]
      expect(() => validator.validateNoDuplicatesInArray(aliases, 'MCP')).toThrow('MCP integrations')
      expect(() => validator.validateNoDuplicatesInArray(aliases, 'RPC')).toThrow('RPC integrations')
    })

    it('includes duplicate alias in error', () => {
      const aliases = [{alias: '/duplicate'}, {alias: '/duplicate'}]
      try {
        validator.validateNoDuplicatesInArray(aliases, 'MCP')
      } catch (error) {
        expect(error.alias).toBe('/duplicate')
      }
    })
  })

  describe('validateNoCrossDuplicates', () => {
    describe('accepts non-overlapping aliases', () => {
      it.each([
        [[], [], 'both empty'],
        [[{alias: '/mcp1'}], [], 'only MCP populated'],
        [[], [{alias: '/rpc1'}], 'only RPC populated'],
        [[{alias: '/mcpAgent'}], [{alias: '/rpcAgent'}], 'different aliases'],
        [[{alias: '/a'}, {alias: '/b'}], [{alias: '/c'}, {alias: '/d'}], 'multiple non-overlapping'],
        [[{alias: '/agent'}], [{alias: '/Agent'}], 'case-sensitive distinction'],
      ])('%s', (mcpAliases, rpcAliases) => {
        expect(() => validator.validateNoCrossDuplicates(mcpAliases, rpcAliases)).not.toThrow()
      })
    })

    describe('rejects overlapping aliases', () => {
      it.each([
        [[{alias: '/shared'}], [{alias: '/shared'}], 'single shared alias'],
        [[{alias: '/a'}, {alias: '/shared'}], [{alias: '/shared'}, {alias: '/b'}], 'shared among other unique'],
        [[{alias: '/x'}, {alias: '/y'}], [{alias: '/x'}, {alias: '/y'}], 'multiple shared aliases'],
      ])('%s', (mcpAliases, rpcAliases) => {
        expect(() => validator.validateNoCrossDuplicates(mcpAliases, rpcAliases)).toThrow(AliasValidationError)
        expect(() => validator.validateNoCrossDuplicates(mcpAliases, rpcAliases)).toThrow(
          'exists in both MCP and RPC integrations',
        )
        expect(() => validator.validateNoCrossDuplicates(mcpAliases, rpcAliases)).toThrow(
          expect.objectContaining({code: 'DUPLICATE_ACROSS_TYPES'}),
        )
      })
    })

    it('includes conflicting alias in error', () => {
      const mcpAliases = [{alias: '/conflict'}]
      const rpcAliases = [{alias: '/conflict'}]
      try {
        validator.validateNoCrossDuplicates(mcpAliases, rpcAliases)
      } catch (error) {
        expect(error.alias).toBe('/conflict')
      }
    })
  })

  describe('validateAlias', () => {
    it('passes for a valid, non-reserved alias', () => {
      expect(() => validator.validateAlias('/myTool')).not.toThrow()
    })
    it('fails on format before checking built-in', () => {
      expect(() => validator.validateAlias('noSlash')).toThrow(expect.objectContaining({code: 'MISSING_SLASH'}))
    })
    it('fails on built-in conflict after format passes', () => {
      expect(() => validator.validateAlias('/chatgpt')).toThrow(expect.objectContaining({code: 'RESERVED_COMMAND'}))
    })
  })

  describe('validateIntegrationArrays (full validation)', () => {
    it('validates valid complete integration setup', () => {
      const mcpAliases = [{alias: '/mcp1'}, {alias: '/mcp2'}]
      const rpcAliases = [{alias: '/rpc1'}, {alias: '/rpc2'}]
      expect(() => validator.validateIntegrationArrays(mcpAliases, rpcAliases)).not.toThrow()
    })

    describe('stops on first error encountered', () => {
      it('reports format error in MCP before checking other validations', () => {
        const mcpAliases = [{alias: 'noSlash'}, {alias: '/dup'}, {alias: '/dup'}]
        expect(() => validator.validateIntegrationArrays(mcpAliases, [])).toThrow('Alias must start with /')
      })

      it('reports built-in conflict in MCP before checking duplicates', () => {
        const mcpAliases = [{alias: '/web'}, {alias: '/dup'}, {alias: '/dup'}]
        expect(() => validator.validateIntegrationArrays(mcpAliases, [])).toThrow('conflicts with a built-in command')
      })

      it('reports format error in RPC before checking other validations', () => {
        const rpcAliases = [{alias: 'noSlash'}, {alias: '/dup'}, {alias: '/dup'}]
        expect(() => validator.validateIntegrationArrays([], rpcAliases)).toThrow('Alias must start with /')
      })
    })

    describe('validates each layer independently', () => {
      it('rejects MCP alias with invalid format', () => {
        const mcpAliases = [{alias: 'noSlash'}]
        expect(() => validator.validateIntegrationArrays(mcpAliases, [])).toThrow('Alias must start with /')
      })

      it('rejects RPC alias with invalid format', () => {
        const rpcAliases = [{alias: '/invalid@'}]
        expect(() => validator.validateIntegrationArrays([], rpcAliases)).toThrow(AliasValidationError)
      })

      it('rejects MCP alias conflicting with built-in', () => {
        const mcpAliases = [{alias: '/chatgpt'}]
        expect(() => validator.validateIntegrationArrays(mcpAliases, [])).toThrow('conflicts with a built-in command')
      })

      it('rejects RPC alias conflicting with built-in', () => {
        const rpcAliases = [{alias: '/foreach'}]
        expect(() => validator.validateIntegrationArrays([], rpcAliases)).toThrow('conflicts with a built-in command')
      })

      it('rejects duplicate within MCP array', () => {
        const mcpAliases = [{alias: '/dup'}, {alias: '/dup'}]
        expect(() => validator.validateIntegrationArrays(mcpAliases, [])).toThrow('Duplicate alias')
      })

      it('rejects duplicate within RPC array', () => {
        const rpcAliases = [{alias: '/dup'}, {alias: '/dup'}]
        expect(() => validator.validateIntegrationArrays([], rpcAliases)).toThrow('Duplicate alias')
      })

      it('rejects cross-duplicate between MCP and RPC', () => {
        const mcpAliases = [{alias: '/shared'}]
        const rpcAliases = [{alias: '/shared'}]
        expect(() => validator.validateIntegrationArrays(mcpAliases, rpcAliases)).toThrow(
          'exists in both MCP and RPC integrations',
        )
      })
    })

    describe('handles edge cases', () => {
      it.each([
        [undefined, undefined, 'both undefined'],
        [[], [], 'both empty arrays'],
        [undefined, [], 'MCP undefined, RPC empty'],
        [[], undefined, 'MCP empty, RPC undefined'],
      ])('accepts %s', (mcpAliases, rpcAliases) => {
        expect(() => validator.validateIntegrationArrays(mcpAliases, rpcAliases)).not.toThrow()
      })
    })
  })
})

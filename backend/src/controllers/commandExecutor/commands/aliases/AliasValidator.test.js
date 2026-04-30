import {AliasValidator, AliasValidationError} from './AliasValidator'

describe('AliasValidator', () => {
  let validator

  beforeEach(() => {
    validator = new AliasValidator()
  })

  describe('validateFormat', () => {
    describe('accepts valid patterns', () => {
      it.each([
        ['/coder', 'lowercase letters only'],
        ['/Agent', 'starts with uppercase letter'],
        ['/MyCustomAgent', 'mixed case letters'],
        ['/coder123', 'letters followed by numbers'],
        ['/agent_v2', 'with underscore'],
        ['/test-alias', 'with hyphen'],
        ['/my_test-agent_v2', 'mixed hyphens and underscores'],
        ['/a', 'single letter'],
        ['/Z', 'single uppercase letter'],
        ['/longAliasNameWithManyCharactersButStillValid123', 'very long name'],
      ])('%s — %s', alias => {
        expect(() => validator.validateFormat(alias)).not.toThrow()
      })
    })

    describe('rejects missing, malformed, or invalid input', () => {
      it.each([
        [null, 'null'],
        [undefined, 'undefined'],
        ['', 'empty string'],
        [123, 'number'],
        [{}, 'object'],
        [[], 'array'],
        [true, 'boolean'],
      ])('rejects %s — %s', input => {
        expect(() => validator.validateFormat(input)).toThrow(AliasValidationError)
        expect(() => validator.validateFormat(input)).toThrow(expect.objectContaining({code: 'INVALID_FORMAT'}))
      })

      it('includes provided value in error', () => {
        try {
          validator.validateFormat(123)
        } catch (error) {
          expect(error.alias).toBe(123)
        }
      })
    })

    describe('rejects missing slash prefix', () => {
      it.each([
        ['coder', 'no slash'],
        ['agent123', 'alphanumeric without slash'],
        ['test_alias', 'with underscore but no slash'],
      ])('%s — %s', alias => {
        expect(() => validator.validateFormat(alias)).toThrow('Alias must start with /')
        expect(() => validator.validateFormat(alias)).toThrow(expect.objectContaining({code: 'MISSING_SLASH'}))
      })
    })

    describe('rejects invalid characters after slash', () => {
      it.each([
        ['/1coder', 'starts with number'],
        ['/_test', 'starts with underscore'],
        ['/-test', 'starts with hyphen'],
        ['/my agent', 'contains space'],
        ['/test\talias', 'contains tab'],
        ['/test\nalias', 'contains newline'],
        ['/coder@host', 'contains @'],
        ['/test!', 'contains exclamation'],
        ['/test.com', 'contains period'],
        ['/path/segment', 'contains slash'],
        ['/test,alias', 'contains comma'],
        ['/test;alias', 'contains semicolon'],
        ['/test:alias', 'contains colon'],
        ['/test?query', 'contains question mark'],
        ['/test#anchor', 'contains hash'],
        ['/test[0]', 'contains brackets'],
        ['/test{obj}', 'contains braces'],
        ['/test|pipe', 'contains pipe'],
        ['/test\\backslash', 'contains backslash'],
        ['/test"quote', 'contains double quote'],
        ["/test'quote", 'contains single quote'],
        ['/test<tag>', 'contains angle brackets'],
        ['/test=value', 'contains equals'],
        ['/test+plus', 'contains plus'],
        ['/test*star', 'contains asterisk'],
        ['/test&ampersand', 'contains ampersand'],
        ['/test%percent', 'contains percent'],
        ['/test$dollar', 'contains dollar sign'],
        ['/test^caret', 'contains caret'],
        ['/test~tilde', 'contains tilde'],
        ['/test`backtick', 'contains backtick'],
      ])('%s — %s', alias => {
        expect(() => validator.validateFormat(alias)).toThrow(AliasValidationError)
        expect(() => validator.validateFormat(alias)).toThrow(expect.objectContaining({code: 'INVALID_CHARACTERS'}))
      })
    })

    it('includes alias in error for all rejection cases', () => {
      const testCases = ['noSlash', '/1invalid', '/test space', '/test@']
      testCases.forEach(testAlias => {
        try {
          validator.validateFormat(testAlias)
        } catch (error) {
          expect(error.alias).toBe(testAlias)
        }
      })
    })
  })

  describe('validateNotBuiltIn', () => {
    describe('accepts non-conflicting aliases', () => {
      it.each([
        ['/mycustom', 'custom name'],
        ['/agent123', 'with number suffix'],
        ['/my_agent', 'with underscore'],
        ['/x', 'single letter'],
        ['/WebSearch', 'similar but different case'],
        ['/chatgpt2', 'built-in with suffix'],
        ['/prechatgpt', 'built-in with prefix'],
      ])('%s — %s', alias => {
        expect(() => validator.validateNotBuiltIn(alias)).not.toThrow()
      })
    })

    describe('rejects aliases conflicting with built-in commands', () => {
      it.each([
        ['/chatgpt', 'chat command'],
        ['/claude', 'claude command'],
        ['/yandexgpt', 'yandex command'],
        ['/web', 'web search command'],
        ['/scholar', 'scholar search command'],
        ['/outline', 'outline command'],
        ['/ext', 'extract command'],
        ['/download', 'download command'],
        ['/steps', 'steps control flow'],
        ['/foreach', 'foreach control flow'],
        ['/switch', 'switch control flow'],
        ['/summarize', 'summarize command'],
        ['/memorize', 'memorize command'],
        ['/refine', 'refine command'],
        ['/perplexity', 'perplexity command'],
        ['/qwen', 'qwen command'],
        ['/deepseek', 'deepseek command'],
        ['/custom', 'custom LLM command'],
      ])('%s — %s', alias => {
        expect(() => validator.validateNotBuiltIn(alias)).toThrow(AliasValidationError)
        expect(() => validator.validateNotBuiltIn(alias)).toThrow(`Alias '${alias}' conflicts with a built-in command`)
        expect(() => validator.validateNotBuiltIn(alias)).toThrow(expect.objectContaining({code: 'RESERVED_COMMAND'}))
      })
    })

    it('includes alias in error for all conflicts', () => {
      const builtInCommands = ['/chatgpt', '/web', '/steps']
      builtInCommands.forEach(builtIn => {
        try {
          validator.validateNotBuiltIn(builtIn)
        } catch (error) {
          expect(error.alias).toBe(builtIn)
        }
      })
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

  describe('validateAlias (composite validation)', () => {
    it('passes when both format and built-in checks pass', () => {
      expect(() => validator.validateAlias('/valid')).not.toThrow()
      expect(() => validator.validateAlias('/myCustomAgent')).not.toThrow()
    })

    it('fails on format error before checking built-in', () => {
      expect(() => validator.validateAlias('noSlash')).toThrow('Alias must start with /')
    })

    it('fails on built-in conflict after format passes', () => {
      expect(() => validator.validateAlias('/web')).toThrow('conflicts with a built-in command')
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

  describe('AliasValidationError class', () => {
    it('is an instance of Error', () => {
      const error = new AliasValidationError('test', 'TEST_CODE', '/test')
      expect(error).toBeInstanceOf(Error)
    })

    it('has name property set to AliasValidationError', () => {
      const error = new AliasValidationError('test', 'TEST_CODE', '/test')
      expect(error.name).toBe('AliasValidationError')
    })

    it('stores code, alias, and message properties', () => {
      const error = new AliasValidationError('test message', 'TEST_CODE', '/myalias')
      expect(error.code).toBe('TEST_CODE')
      expect(error.alias).toBe('/myalias')
      expect(error.message).toBe('test message')
    })

    it('has correct prototype chain', () => {
      const error = new AliasValidationError('test', 'CODE', '/alias')
      expect(Object.getPrototypeOf(error)).toBe(AliasValidationError.prototype)
      expect(Object.getPrototypeOf(AliasValidationError.prototype)).toBe(Error.prototype)
    })

    it.each([
      ['INVALID_FORMAT', 'format validation'],
      ['MISSING_SLASH', 'slash validation'],
      ['INVALID_CHARACTERS', 'character validation'],
      ['RESERVED_COMMAND', 'built-in conflict'],
      ['DUPLICATE_IN_ARRAY', 'array duplicate'],
      ['DUPLICATE_ACROSS_TYPES', 'cross-type duplicate'],
    ])('can be created with code %s for %s', code => {
      const error = new AliasValidationError('test', code, '/test')
      expect(error.code).toBe(code)
    })
  })
})

import {
  isValidAlias,
  validateAlias,
  validateFormat,
  validateNotBuiltIn,
  AliasValidationError,
  VALID_ALIAS_PATTERN,
  BUILT_IN_COMMANDS,
} from './aliasValidation'

describe('aliasValidation', () => {
  describe('VALID_ALIAS_PATTERN', () => {
    it('is exported as regex', () => {
      expect(VALID_ALIAS_PATTERN).toBeInstanceOf(RegExp)
      expect(VALID_ALIAS_PATTERN.test('/valid')).toBe(true)
    })

    it('enforces letter start after slash', () => {
      expect(VALID_ALIAS_PATTERN.test('/a')).toBe(true)
      expect(VALID_ALIAS_PATTERN.test('/Z')).toBe(true)
      expect(VALID_ALIAS_PATTERN.test('/1invalid')).toBe(false)
      expect(VALID_ALIAS_PATTERN.test('/_invalid')).toBe(false)
    })

    it('allows letters, numbers, hyphens, underscores in body', () => {
      expect(VALID_ALIAS_PATTERN.test('/aZ0-_')).toBe(true)
      expect(VALID_ALIAS_PATTERN.test('/test space')).toBe(false)
      expect(VALID_ALIAS_PATTERN.test('/test@')).toBe(false)
    })
  })

  describe('BUILT_IN_COMMANDS', () => {
    it('is exported as Set', () => {
      expect(BUILT_IN_COMMANDS).toBeInstanceOf(Set)
      expect(BUILT_IN_COMMANDS.size).toBeGreaterThan(0)
    })

    it('contains known built-in commands', () => {
      expect(BUILT_IN_COMMANDS.has('/chatgpt')).toBe(true)
      expect(BUILT_IN_COMMANDS.has('/web')).toBe(true)
      expect(BUILT_IN_COMMANDS.has('/steps')).toBe(true)
    })
  })

  describe('AliasValidationError', () => {
    it('is exported as Error subclass', () => {
      const error = new AliasValidationError('test', 'CODE', '/alias')
      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('AliasValidationError')
    })

    it('stores message, code, and alias', () => {
      const error = new AliasValidationError('msg', 'TEST_CODE', '/test')
      expect(error.message).toBe('msg')
      expect(error.code).toBe('TEST_CODE')
      expect(error.alias).toBe('/test')
    })
  })

  describe('validateFormat', () => {
    it('throws INVALID_FORMAT for non-string input', () => {
      expect(() => validateFormat(null)).toThrow(AliasValidationError)
      expect(() => validateFormat(null)).toThrow(expect.objectContaining({code: 'INVALID_FORMAT'}))
      expect(() => validateFormat(123)).toThrow(expect.objectContaining({code: 'INVALID_FORMAT'}))
    })

    it('throws MISSING_SLASH when slash prefix is missing', () => {
      expect(() => validateFormat('noSlash')).toThrow(AliasValidationError)
      expect(() => validateFormat('noSlash')).toThrow(expect.objectContaining({code: 'MISSING_SLASH'}))
    })

    it('throws INVALID_CHARACTERS for pattern violations', () => {
      expect(() => validateFormat('/1invalid')).toThrow(AliasValidationError)
      expect(() => validateFormat('/1invalid')).toThrow(expect.objectContaining({code: 'INVALID_CHARACTERS'}))
      expect(() => validateFormat('/test space')).toThrow(expect.objectContaining({code: 'INVALID_CHARACTERS'}))
    })

    it('succeeds for valid aliases', () => {
      expect(() => validateFormat('/valid')).not.toThrow()
      expect(() => validateFormat('/test-alias_v2')).not.toThrow()
    })
  })

  describe('validateNotBuiltIn', () => {
    it('throws RESERVED_COMMAND for built-in conflicts', () => {
      expect(() => validateNotBuiltIn('/chatgpt')).toThrow(AliasValidationError)
      expect(() => validateNotBuiltIn('/chatgpt')).toThrow(expect.objectContaining({code: 'RESERVED_COMMAND'}))
      expect(() => validateNotBuiltIn('/web')).toThrow(expect.objectContaining({code: 'RESERVED_COMMAND'}))
    })

    it('succeeds for non-conflicting aliases', () => {
      expect(() => validateNotBuiltIn('/myCustomAgent')).not.toThrow()
      expect(() => validateNotBuiltIn('/chatgpt2')).not.toThrow()
      expect(() => validateNotBuiltIn('/agent_v1')).not.toThrow()
    })
  })

  describe('validateAlias', () => {
    it('throws for format violations before checking built-in', () => {
      expect(() => validateAlias('noSlash')).toThrow(expect.objectContaining({code: 'MISSING_SLASH'}))
      expect(() => validateAlias('/1invalid')).toThrow(expect.objectContaining({code: 'INVALID_CHARACTERS'}))
    })

    it('throws for built-in conflicts after format passes', () => {
      expect(() => validateAlias('/chatgpt')).toThrow(expect.objectContaining({code: 'RESERVED_COMMAND'}))
    })

    it('succeeds when both format and built-in checks pass', () => {
      expect(() => validateAlias('/valid')).not.toThrow()
      expect(() => validateAlias('/myCustomAgent')).not.toThrow()
    })
  })

  describe('isValidAlias', () => {
    describe('accepts valid patterns', () => {
      it.each([
        ['/coder1', 'lowercase with number'],
        ['/vm3', 'short name with number'],
        ['/test-alias', 'with hyphen'],
        ['/test_alias', 'with underscore'],
        ['/a', 'single letter'],
        ['/A1B2C3', 'uppercase with numbers'],
        ['/myTool', 'camelCase'],
        ['/MyTool', 'PascalCase'],
        ['/tool123', 'ending with numbers'],
        ['/x-y-z', 'multiple hyphens'],
        ['/x_y_z', 'multiple underscores'],
        ['/a1-b2_c3', 'mixed separators'],
      ])('accepts: %s (%s)', alias => {
        expect(isValidAlias(alias)).toBe(true)
      })
    })

    describe('rejects missing, malformed, or invalid prefix', () => {
      it.each([
        [null, 'null'],
        [undefined, 'undefined'],
        ['', 'empty string'],
        ['/', 'slash only'],
        ['coder1', 'no slash'],
        ['vm3', 'no slash with number'],
        ['test-alias', 'hyphenated no slash'],
        ['  /test  ', 'untrimmed whitespace'],
        ['/1test', 'starts with digit'],
        ['/9abc', 'starts with digit'],
        ['/_test', 'starts with underscore'],
        ['/-test', 'starts with hyphen'],
        ['/!test', 'starts with special char'],
        ['/@tool', 'starts with @'],
        ['/#cmd', 'starts with #'],
      ])('rejects: %p (%s)', alias => {
        expect(isValidAlias(alias)).toBe(false)
      })
    })

    describe('rejects invalid characters in body', () => {
      it.each([
        ['/test alias', 'contains space'],
        ['/test\talias', 'contains tab'],
        ['/test\nalias', 'contains newline'],
        ['/test@alias', 'contains @'],
        ['/test.alias', 'contains dot'],
        ['/test!alias', 'contains exclamation'],
        ['/test$var', 'contains dollar'],
        ['/test%20', 'contains percent'],
        ['/test&cmd', 'contains ampersand'],
        ['/test*glob', 'contains asterisk'],
        ['/test+more', 'contains plus'],
        ['/test=val', 'contains equals'],
        ['/test[0]', 'contains brackets'],
        ['/test{a}', 'contains braces'],
        ['/test|cmd', 'contains pipe'],
        ['/test\\path', 'contains backslash'],
        ['/test/nested', 'contains nested slash'],
        ['/test:cmd', 'contains colon'],
        ['/test;cmd', 'contains semicolon'],
        ["/test'quote", 'contains single quote'],
        ['/test"quote', 'contains double quote'],
        ['/test<tag', 'contains less-than'],
        ['/test>file', 'contains greater-than'],
        ['/test?query', 'contains question mark'],
        ['/test,list', 'contains comma'],
      ])('rejects: %s (%s)', alias => {
        expect(isValidAlias(alias)).toBe(false)
      })
    })

    describe('prevents collision with built-in commands', () => {
      it.each([
        ['/chatgpt', 'chat command'],
        ['/claude', 'claude command'],
        ['/yandexgpt', 'yandex command'],
        ['/qwen', 'qwen command'],
        ['/deepseek', 'deepseek command'],
        ['/perplexity', 'perplexity command'],
        ['/custom', 'custom LLM command'],
        ['/steps', 'steps control flow'],
        ['/foreach', 'foreach control flow'],
        ['/switch', 'switch control flow'],
        ['/summarize', 'summarize post-process'],
        ['/memorize', 'memorize post-process'],
        ['/outline', 'outline command'],
        ['/refine', 'refine command'],
        ['/web', 'web search command'],
        ['/scholar', 'scholar search command'],
        ['/download', 'download command'],
        ['/ext', 'ext (knowledge base) command'],
      ])('rejects built-in: %s (%s)', alias => {
        expect(isValidAlias(alias)).toBe(false)
      })
    })

    describe('boundary conditions', () => {
      it('accepts single-letter aliases', () => {
        expect(isValidAlias('/a')).toBe(true)
        expect(isValidAlias('/Z')).toBe(true)
      })

      it('accepts long aliases', () => {
        const longAlias = '/a' + 'x'.repeat(100)
        expect(isValidAlias(longAlias)).toBe(true)
      })

      it('accepts aliases ending with hyphen or underscore', () => {
        expect(isValidAlias('/test-')).toBe(true)
        expect(isValidAlias('/test_')).toBe(true)
      })

      it('accepts consecutive hyphens and underscores', () => {
        expect(isValidAlias('/test--double')).toBe(true)
        expect(isValidAlias('/test__double')).toBe(true)
      })
    })
  })

  describe('cross-layer equivalence', () => {
    describe('isValidAlias and validateAlias are logically equivalent', () => {
      it.each([
        ['/valid', true, null],
        ['/test-alias_v2', true, null],
        ['noSlash', false, 'MISSING_SLASH'],
        ['/1invalid', false, 'INVALID_CHARACTERS'],
        ['/chatgpt', false, 'RESERVED_COMMAND'],
        [null, false, 'INVALID_FORMAT'],
        ['/test space', false, 'INVALID_CHARACTERS'],
      ])('alias=%p: isValid=%s, expectedCode=%s', (alias, expectedValid, expectedCode) => {
        const isValid = isValidAlias(alias)
        expect(isValid).toBe(expectedValid)

        if (expectedValid) {
          expect(() => validateAlias(alias)).not.toThrow()
        } else {
          expect(() => validateAlias(alias)).toThrow(AliasValidationError)
          expect(() => validateAlias(alias)).toThrow(expect.objectContaining({code: expectedCode}))
        }
      })
    })

    it('guarantees isValidAlias(x) === true iff validateAlias(x) does not throw', () => {
      const testCases = [
        '/valid',
        '/test123',
        'invalid',
        '/1bad',
        '/web',
        null,
        '/test-alias',
        '/chatgpt',
        '/my_custom',
      ]

      testCases.forEach(testCase => {
        const boolResult = isValidAlias(testCase)
        let throwResult = false
        try {
          validateAlias(testCase)
          throwResult = true
        } catch (error) {
          if (error instanceof AliasValidationError) {
            throwResult = false
          } else {
            throw error
          }
        }

        expect(boolResult).toBe(throwResult)
      })
    })
  })
})

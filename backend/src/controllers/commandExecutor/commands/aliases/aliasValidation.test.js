import {isValidAlias} from './aliasValidation'

describe('aliasValidation', () => {
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
})

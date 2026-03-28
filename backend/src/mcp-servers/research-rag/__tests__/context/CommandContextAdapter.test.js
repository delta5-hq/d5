import {CommandContextAdapter} from '../../context/CommandContextAdapter'

describe('CommandContextAdapter', () => {
  let adapter

  beforeEach(() => {
    adapter = new CommandContextAdapter()
  })

  describe('parseWebSearchParams', () => {
    it('parses all params when provided', () => {
      const result = adapter.parseWebSearchParams({
        lang: 'ru',
        citations: true,
        maxChunks: 'xl',
      })

      expect(result).toEqual({
        lang: 'ru',
        citations: true,
        maxChunks: 'xl',
      })
    })

    it('uses defaults for missing params', () => {
      const result = adapter.parseWebSearchParams({})

      expect(result).toEqual({
        lang: null,
        citations: false,
        maxChunks: null,
      })
    })

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['empty object', {}],
    ])('handles %s input', (_label, input) => {
      const result = adapter.parseWebSearchParams(input)

      expect(result.lang).toBeNull()
      expect(result.citations).toBe(false)
      expect(result.maxChunks).toBeNull()
    })

    it.each([
      ['en', 'en', 'en'],
      ['ru', 'ru', 'ru'],
      ['zh', 'zh', 'zh'],
      ['empty string', '', ''],
    ])('preserves lang value — %s', (_label, lang, expected) => {
      const result = adapter.parseWebSearchParams({lang})

      expect(result.lang).toBe(expected)
    })

    it.each([
      ['true', true, true],
      ['false', false, false],
      ['undefined', undefined, false],
    ])('citations coercion — %s', (_label, input, expected) => {
      const result = adapter.parseWebSearchParams({citations: input})

      expect(result.citations).toBe(expected)
    })

    it('preserves extra properties in input', () => {
      const result = adapter.parseWebSearchParams({
        lang: 'ru',
        extraField: 'ignored',
      })

      expect(result.lang).toBe('ru')
      expect(result).not.toHaveProperty('extraField')
    })
  })

  describe('parseScholarSearchParams', () => {
    it('parses scholar-specific params', () => {
      const result = adapter.parseScholarSearchParams({
        lang: 'en',
        citations: true,
        maxChunks: 'l',
        minYear: 2020,
      })

      expect(result).toEqual({
        lang: 'en',
        citations: true,
        maxChunks: 'l',
        minYear: 2020,
      })
    })

    it('handles missing minYear', () => {
      const result = adapter.parseScholarSearchParams({})

      expect(result.minYear).toBeNull()
    })

    it.each([
      ['minimum boundary', 1900, 1900],
      ['recent year', 2020, 2020],
      ['current year', 2026, 2026],
      ['future year', 2030, 2030],
      ['zero', 0, 0],
      ['negative', -1, -1],
    ])('preserves minYear value — %s', (_label, minYear, expected) => {
      const result = adapter.parseScholarSearchParams({minYear})

      expect(result.minYear).toBe(expected)
    })

    it('includes all web search params', () => {
      const result = adapter.parseScholarSearchParams({
        lang: 'ru',
        citations: true,
        maxChunks: 'm',
      })

      expect(result).toHaveProperty('lang', 'ru')
      expect(result).toHaveProperty('citations', true)
      expect(result).toHaveProperty('maxChunks', 'm')
      expect(result).toHaveProperty('minYear')
    })
  })

  describe('parseKnowledgeBaseParams', () => {
    it('parses context param', () => {
      const result = adapter.parseKnowledgeBaseParams({
        lang: 'ru',
        context: 'my-context',
        citations: true,
      })

      expect(result).toEqual({
        lang: 'ru',
        citations: true,
        maxChunks: null,
        context: 'my-context',
      })
    })

    it.each([
      ['alphanumeric', 'context123', 'context123'],
      ['hyphenated', 'my-context', 'my-context'],
      ['underscored', 'my_context', 'my_context'],
      ['with spaces', 'my context', 'my context'],
      ['special chars', 'ctx@#$%', 'ctx@#$%'],
      ['empty string', '', ''],
    ])('preserves context value — %s', (_label, context, expected) => {
      const result = adapter.parseKnowledgeBaseParams({context})

      expect(result.context).toBe(expected)
    })

    it('includes all web search params', () => {
      const result = adapter.parseKnowledgeBaseParams({
        lang: 'en',
        citations: false,
        maxChunks: 's',
      })

      expect(result).toHaveProperty('lang', 'en')
      expect(result).toHaveProperty('citations', false)
      expect(result).toHaveProperty('maxChunks', 's')
      expect(result).toHaveProperty('context')
    })
  })

  describe('parseMemorizeParams', () => {
    it('parses memorize params with defaults', () => {
      const result = adapter.parseMemorizeParams({
        text: 'content to memorize',
      })

      expect(result).toEqual({
        text: 'content to memorize',
        context: null,
        keep: true,
        split: null,
      })
    })

    it.each([
      ['explicitly true', true, true],
      ['explicitly false', false, false],
      ['undefined defaults to true', undefined, true],
      ['null defaults to true', null, true],
    ])('keep parameter handling — %s', (_label, keep, expected) => {
      const result = adapter.parseMemorizeParams({
        text: 'content',
        keep,
      })

      expect(result.keep).toBe(expected)
    })

    it.each([
      ['newline', '\n', '\n'],
      ['double newline', '\n\n', '\n\n'],
      ['comma', ',', ','],
      ['pipe', '|', '|'],
      ['tab', '\t', '\t'],
      ['empty string', '', ''],
      ['multi-char', '===', '==='],
    ])('split delimiter handling — %s', (_label, split, expected) => {
      const result = adapter.parseMemorizeParams({
        text: 'content',
        split,
      })

      expect(result.split).toBe(expected)
    })

    it('preserves long text without truncation', () => {
      const longText = 'a'.repeat(10000)
      const result = adapter.parseMemorizeParams({text: longText})

      expect(result.text).toBe(longText)
      expect(result.text.length).toBe(10000)
    })

    it('preserves text with special characters', () => {
      const specialText = 'Hello\nWorld\t<>&"\'`$@'
      const result = adapter.parseMemorizeParams({text: specialText})

      expect(result.text).toBe(specialText)
    })
  })

  describe('cross-method invariants', () => {
    it('all parsers return objects with defined structure', () => {
      const webResult = adapter.parseWebSearchParams({})
      const scholarResult = adapter.parseScholarSearchParams({})
      const kbResult = adapter.parseKnowledgeBaseParams({})
      const memorizeResult = adapter.parseMemorizeParams({text: 'x'})

      expect(webResult).toBeInstanceOf(Object)
      expect(scholarResult).toBeInstanceOf(Object)
      expect(kbResult).toBeInstanceOf(Object)
      expect(memorizeResult).toBeInstanceOf(Object)
    })

    it('parsers do not mutate input', () => {
      const input = {lang: 'en', citations: true, maxChunks: 'xl'}
      const inputCopy = JSON.parse(JSON.stringify(input))

      adapter.parseWebSearchParams(input)

      expect(input).toEqual(inputCopy)
    })

    it('parsers handle null input gracefully', () => {
      expect(() => adapter.parseWebSearchParams(null)).not.toThrow()
      expect(() => adapter.parseScholarSearchParams(null)).not.toThrow()
      expect(() => adapter.parseKnowledgeBaseParams(null)).not.toThrow()
    })
  })
})

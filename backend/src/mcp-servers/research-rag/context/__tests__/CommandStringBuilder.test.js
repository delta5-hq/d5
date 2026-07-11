import {CommandStringBuilder} from '../CommandStringBuilder'

describe('CommandStringBuilder', () => {
  let builder

  beforeEach(() => {
    builder = new CommandStringBuilder()
  })

  describe('buildCommandString', () => {
    describe('null and empty input handling', () => {
      it.each([
        ['null', null],
        ['undefined', undefined],
        ['empty object', {}],
      ])('returns empty string for %s input', (_label, input) => {
        expect(builder.buildCommandString(input)).toBe('')
      })
    })

    describe('single flag construction', () => {
      it.each([
        ['lang with en', {lang: 'en'}, '--lang=en'],
        ['lang with ru', {lang: 'ru'}, '--lang=ru'],
        ['lang with zh', {lang: 'zh'}, '--lang=zh'],
        ['citations true', {citations: true}, '--citations'],
        ['maxChunks xxs', {maxChunks: 'xxs'}, '--max-chunks=xxs'],
        ['maxChunks xs', {maxChunks: 'xs'}, '--max-chunks=xs'],
        ['maxChunks s', {maxChunks: 's'}, '--max-chunks=s'],
        ['maxChunks m', {maxChunks: 'm'}, '--max-chunks=m'],
        ['maxChunks l', {maxChunks: 'l'}, '--max-chunks=l'],
        ['maxChunks xl', {maxChunks: 'xl'}, '--max-chunks=xl'],
        ['maxChunks xxl', {maxChunks: 'xxl'}, '--max-chunks=xxl'],
        ['minYear 2020', {minYear: 2020}, '--min-year=2020'],
        ['minYear 1900', {minYear: 1900}, '--min-year=1900'],
        ['minYear 2030', {minYear: 2030}, '--min-year=2030'],
        ['context alphanumeric', {context: 'my-kb'}, '--context=my-kb'],
        ['context with underscore', {context: 'my_kb'}, '--context=my_kb'],
        ['context with spaces', {context: 'my kb'}, '--context=my kb'],
      ])('builds %s', (_label, params, expected) => {
        expect(builder.buildCommandString(params)).toBe(expected)
      })
    })

    describe('flag omission rules', () => {
      it.each([
        ['citations false', {citations: false}],
        ['citations undefined', {citations: undefined}],
        ['citations null', {citations: null}],
        ['lang empty string', {lang: ''}],
        ['maxChunks empty string', {maxChunks: ''}],
        ['context empty string', {context: ''}],
        ['minYear zero', {minYear: 0}],
      ])('omits flag for %s', (_label, params) => {
        expect(builder.buildCommandString(params)).toBe('')
      })
    })

    describe('multi-flag combination', () => {
      it('combines all flags in canonical order', () => {
        const result = builder.buildCommandString({
          context: 'kb',
          minYear: 2021,
          lang: 'en',
          maxChunks: 'm',
          citations: true,
        })
        expect(result).toBe('--lang=en --citations --max-chunks=m --min-year=2021 --context=kb')
      })

      it('omits false citations in multi-flag scenario', () => {
        const result = builder.buildCommandString({
          lang: 'ru',
          citations: false,
          maxChunks: 'xl',
        })
        expect(result).toBe('--lang=ru --max-chunks=xl')
      })

      it('preserves order with partial params', () => {
        const result = builder.buildCommandString({
          lang: 'ru',
          minYear: 2020,
        })
        expect(result).toBe('--lang=ru --min-year=2020')
      })
    })

    describe('edge cases and boundaries', () => {
      it('handles minYear negative value', () => {
        expect(builder.buildCommandString({minYear: -1})).toBe('--min-year=-1')
      })

      it('handles very large minYear', () => {
        expect(builder.buildCommandString({minYear: 9999})).toBe('--min-year=9999')
      })

      it('handles lang with special characters', () => {
        expect(builder.buildCommandString({lang: 'pt-BR'})).toBe('--lang=pt-BR')
      })

      it('handles context with special characters', () => {
        expect(builder.buildCommandString({context: 'ctx@#$%'})).toBe('--context=ctx@#$%')
      })

      it('ignores extra properties not in schema', () => {
        const result = builder.buildCommandString({
          lang: 'ru',
          unknownField: 'value',
        })
        expect(result).toBe('--lang=ru')
        expect(result).not.toContain('unknownField')
      })
    })

    describe('determineLLMType integration scenarios', () => {
      it('builds command string that triggers YandexGPT routing', () => {
        const result = builder.buildCommandString({lang: 'ru'})
        expect(result).toBe('--lang=ru')
      })

      it('builds command string that preserves explicit lang with other flags', () => {
        const result = builder.buildCommandString({
          lang: 'ru',
          citations: true,
          maxChunks: 'l',
        })
        expect(result).toContain('--lang=ru')
        expect(result).toContain('--citations')
        expect(result).toContain('--max-chunks=l')
      })
    })
  })

  describe('buildSyntheticNode', () => {
    describe('null node generation', () => {
      it.each([
        ['empty object', {}],
        ['null', null],
        ['undefined', undefined],
        ['only false citations', {citations: false}],
        ['only empty lang', {lang: ''}],
        ['only zero minYear', {minYear: 0}],
      ])('returns null for %s', (_label, params) => {
        expect(builder.buildSyntheticNode(params)).toBeNull()
      })
    })

    describe('node structure generation', () => {
      it('returns node with command property for single flag', () => {
        const result = builder.buildSyntheticNode({lang: 'ru'})
        expect(result).toEqual({command: '--lang=ru'})
        expect(result).toHaveProperty('command')
        expect(Object.keys(result)).toHaveLength(1)
      })

      it('returns node with combined command for multiple flags', () => {
        const result = builder.buildSyntheticNode({
          lang: 'ru',
          citations: true,
          maxChunks: 'xl',
        })
        expect(result).toEqual({command: '--lang=ru --citations --max-chunks=xl'})
      })

      it('returns node compatible with command optional chaining', () => {
        const result = builder.buildSyntheticNode({lang: 'en'})
        expect(result?.command).toBe('--lang=en')
      })
    })

    describe('delegation compatibility', () => {
      it('generates node structure accepted by WebCommand.createResponseWeb', () => {
        const node = builder.buildSyntheticNode({lang: 'ru', citations: true})
        expect(node).toBeDefined()
        expect(node.command).toBeTruthy()
        expect(typeof node.command).toBe('string')
      })

      it('generates null node when no params affect determineLLMType', () => {
        const node = builder.buildSyntheticNode({})
        expect(node).toBeNull()
      })
    })
  })

  describe('cross-method consistency', () => {
    it('buildSyntheticNode wraps buildCommandString result', () => {
      const params = {lang: 'ru', citations: true}
      const commandString = builder.buildCommandString(params)
      const node = builder.buildSyntheticNode(params)

      expect(node.command).toBe(commandString)
    })

    it('both methods handle empty params consistently', () => {
      const commandString = builder.buildCommandString({})
      const node = builder.buildSyntheticNode({})

      expect(commandString).toBe('')
      expect(node).toBeNull()
    })

    it('both methods do not mutate input', () => {
      const params = {lang: 'ru', citations: true}
      const paramsCopy = JSON.parse(JSON.stringify(params))

      builder.buildCommandString(params)
      builder.buildSyntheticNode(params)

      expect(params).toEqual(paramsCopy)
    })
  })
})

import {OutlineCommandStringBuilder} from '../../context/OutlineCommandStringBuilder'

describe('OutlineCommandStringBuilder', () => {
  let builder

  beforeEach(() => {
    builder = new OutlineCommandStringBuilder()
  })

  describe('buildCommandString', () => {
    it('returns empty string when no params provided', () => {
      const result = builder.buildCommandString()

      expect(result).toBe('')
    })

    it('returns empty string when params is empty object', () => {
      const result = builder.buildCommandString({})

      expect(result).toBe('')
    })

    it('builds string with lang flag', () => {
      const result = builder.buildCommandString({lang: 'ru'})

      expect(result).toBe('--lang=ru')
    })

    it('builds string with citations flag', () => {
      const result = builder.buildCommandString({citations: true})

      expect(result).toBe('--citations')
    })

    it('builds string with maxChunks flag', () => {
      const result = builder.buildCommandString({maxChunks: 5})

      expect(result).toBe('--max-chunks=5')
    })

    it('builds string with context flag', () => {
      const result = builder.buildCommandString({context: 'my-context'})

      expect(result).toBe('--context=my-context')
    })

    it('combines multiple flags with space separator', () => {
      const result = builder.buildCommandString({
        lang: 'en',
        citations: true,
        maxChunks: 10,
      })

      expect(result).toContain('--lang=en')
      expect(result).toContain('--citations')
      expect(result).toContain('--max-chunks=10')
    })

    it('omits flags with falsy values', () => {
      const result = builder.buildCommandString({
        lang: null,
        citations: false,
        maxChunks: 0,
      })

      expect(result).not.toContain('--lang')
      expect(result).not.toContain('--citations')
    })

    it('handles context with special characters', () => {
      const result = builder.buildCommandString({context: 'test-context_123'})

      expect(result).toBe('--context=test-context_123')
    })

    it('handles all flags together', () => {
      const result = builder.buildCommandString({
        lang: 'ru',
        citations: true,
        maxChunks: 20,
        context: 'research',
      })

      expect(result).toContain('--lang=ru')
      expect(result).toContain('--citations')
      expect(result).toContain('--max-chunks=20')
      expect(result).toContain('--context=research')
    })
  })

  describe('buildSyntheticNode', () => {
    it('returns null when no params provided', () => {
      const result = builder.buildSyntheticNode()

      expect(result).toBeNull()
    })

    it('returns null when params produce empty command string', () => {
      const result = builder.buildSyntheticNode({})

      expect(result).toBeNull()
    })

    it('returns node with command property when flags present', () => {
      const result = builder.buildSyntheticNode({lang: 'en'})

      expect(result).toEqual({command: '--lang=en'})
    })

    it('node contains full command string', () => {
      const result = builder.buildSyntheticNode({
        lang: 'ru',
        citations: true,
        maxChunks: 15,
      })

      expect(result.command).toContain('--lang=ru')
      expect(result.command).toContain('--citations')
      expect(result.command).toContain('--max-chunks=15')
    })

    it('delegates to buildCommandString for string construction', () => {
      const buildSpy = jest.spyOn(builder, 'buildCommandString')
      const params = {lang: 'en', citations: true}

      builder.buildSyntheticNode(params)

      expect(buildSpy).toHaveBeenCalledWith(params)
    })
  })
})

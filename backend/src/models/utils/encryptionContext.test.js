import {EncryptionContextValidator, ADContextBuilder} from './encryptionContext'
import adBuilder from './adBuilder'

describe('EncryptionContextValidator', () => {
  describe('validate', () => {
    it('returns null for null context', () => {
      expect(EncryptionContextValidator.validate(null)).toBeNull()
    })

    it('returns null for undefined context', () => {
      expect(EncryptionContextValidator.validate(undefined)).toBeNull()
    })

    it('throws for non-object context', () => {
      expect(() => EncryptionContextValidator.validate('string')).toThrow('must be an object')
      expect(() => EncryptionContextValidator.validate(123)).toThrow('must be an object')
    })

    it('throws for missing userId', () => {
      expect(() => EncryptionContextValidator.validate({workflowId: 'wf-1'})).toThrow('requires valid userId')
    })

    it('throws for invalid userId type', () => {
      expect(() => EncryptionContextValidator.validate({userId: 123})).toThrow('requires valid userId')
    })

    it('throws for invalid workflowId type', () => {
      expect(() => EncryptionContextValidator.validate({userId: 'user-1', workflowId: 123})).toThrow(
        'workflowId must be string',
      )
    })

    it('normalizes valid context with workflowId', () => {
      const result = EncryptionContextValidator.validate({userId: 'user-1', workflowId: 'wf-1'})
      expect(result).toEqual({userId: 'user-1', workflowId: 'wf-1'})
    })

    it('normalizes null workflowId', () => {
      const result = EncryptionContextValidator.validate({userId: 'user-1', workflowId: null})
      expect(result).toEqual({userId: 'user-1', workflowId: null})
    })

    it('normalizes undefined workflowId to null', () => {
      const result = EncryptionContextValidator.validate({userId: 'user-1'})
      expect(result).toEqual({userId: 'user-1', workflowId: null})
    })

    it('normalizes empty string workflowId to null', () => {
      const result = EncryptionContextValidator.validate({userId: 'user-1', workflowId: ''})
      expect(result).toEqual({userId: 'user-1', workflowId: null})
    })
  })
})

describe('ADContextBuilder', () => {
  let builder

  beforeEach(() => {
    builder = new ADContextBuilder(adBuilder)
  })

  describe('buildForLLMField', () => {
    it('returns null when context is null', () => {
      expect(builder.buildForLLMField(null, 'openai.apiKey')).toBeNull()
    })

    it('returns null when context is undefined', () => {
      expect(builder.buildForLLMField(undefined, 'openai.apiKey')).toBeNull()
    })

    it('builds AD for user-level context', () => {
      const ad = builder.buildForLLMField({userId: 'user-1', workflowId: null}, 'openai.apiKey')

      expect(ad).toBeInstanceOf(Buffer)
      expect(ad.length).toBeGreaterThan(0)
    })

    it('builds AD for workflow-scoped context', () => {
      const ad = builder.buildForLLMField({userId: 'user-1', workflowId: 'wf-1'}, 'claude.apiKey')

      expect(ad).toBeInstanceOf(Buffer)
      expect(ad.length).toBeGreaterThan(0)
    })

    it('produces different AD for different users', () => {
      const ad1 = builder.buildForLLMField({userId: 'user-1', workflowId: null}, 'openai.apiKey')
      const ad2 = builder.buildForLLMField({userId: 'user-2', workflowId: null}, 'openai.apiKey')

      expect(ad1.equals(ad2)).toBe(false)
    })

    it('produces different AD for different workflows', () => {
      const ad1 = builder.buildForLLMField({userId: 'user-1', workflowId: 'wf-1'}, 'openai.apiKey')
      const ad2 = builder.buildForLLMField({userId: 'user-1', workflowId: 'wf-2'}, 'openai.apiKey')

      expect(ad1.equals(ad2)).toBe(false)
    })

    it('produces different AD for different fields', () => {
      const ad1 = builder.buildForLLMField({userId: 'user-1', workflowId: null}, 'openai.apiKey')
      const ad2 = builder.buildForLLMField({userId: 'user-1', workflowId: null}, 'claude.apiKey')

      expect(ad1.equals(ad2)).toBe(false)
    })
  })

  describe('buildForArrayField', () => {
    it('returns null when context is null', () => {
      expect(builder.buildForArrayField(null, 'mcp', 'srv', 'headers')).toBeNull()
    })

    it('returns null when context is undefined', () => {
      expect(builder.buildForArrayField(undefined, 'mcp', 'srv', 'headers')).toBeNull()
    })

    it('throws when alias is missing', () => {
      expect(() => builder.buildForArrayField({userId: 'user-1', workflowId: null}, 'mcp', null, 'headers')).toThrow(
        "Array item in 'mcp' missing required alias field",
      )
    })

    it('throws when alias is empty string', () => {
      expect(() => builder.buildForArrayField({userId: 'user-1', workflowId: null}, 'rpc', '', 'privateKey')).toThrow(
        "Array item in 'rpc' missing required alias field",
      )
    })

    it('throws when alias is not a string', () => {
      expect(() => builder.buildForArrayField({userId: 'user-1', workflowId: null}, 'mcp', 123, 'headers')).toThrow(
        "Array item in 'mcp' missing required alias field",
      )
    })

    it('builds AD for valid array field', () => {
      const ad = builder.buildForArrayField({userId: 'user-1', workflowId: null}, 'mcp', 'srv', 'headers')

      expect(ad).toBeInstanceOf(Buffer)
      expect(ad.length).toBeGreaterThan(0)
    })

    it('produces different AD for different aliases', () => {
      const ad1 = builder.buildForArrayField({userId: 'user-1', workflowId: null}, 'mcp', 'srv1', 'headers')
      const ad2 = builder.buildForArrayField({userId: 'user-1', workflowId: null}, 'mcp', 'srv2', 'headers')

      expect(ad1.equals(ad2)).toBe(false)
    })

    it('produces different AD for different array names', () => {
      const ad1 = builder.buildForArrayField({userId: 'user-1', workflowId: null}, 'mcp', 'srv', 'headers')
      const ad2 = builder.buildForArrayField({userId: 'user-1', workflowId: null}, 'rpc', 'srv', 'headers')

      expect(ad1.equals(ad2)).toBe(false)
    })

    it('produces different AD for different fields', () => {
      const ad1 = builder.buildForArrayField({userId: 'user-1', workflowId: null}, 'mcp', 'srv', 'headers')
      const ad2 = builder.buildForArrayField({userId: 'user-1', workflowId: null}, 'mcp', 'srv', 'env')

      expect(ad1.equals(ad2)).toBe(false)
    })
  })
})

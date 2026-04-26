import adBuilder from './adBuilder'

describe('ADBuilder', () => {
  describe('buildForLLMField', () => {
    it('builds AD with all parts present', () => {
      const ad = adBuilder.buildForLLMField('user-123', 'workflow-456', 'openai.apiKey')

      const parts = parseAD(ad)
      expect(parts).toEqual(['integrations', 'user-123', 'workflow-456', 'openai.apiKey'])
    })

    it('normalizes null workflowId to empty string', () => {
      const ad = adBuilder.buildForLLMField('user-123', null, 'openai.apiKey')

      const parts = parseAD(ad)
      expect(parts).toEqual(['integrations', 'user-123', '', 'openai.apiKey'])
    })

    it('normalizes undefined workflowId to empty string', () => {
      const ad = adBuilder.buildForLLMField('user-123', undefined, 'openai.apiKey')

      const parts = parseAD(ad)
      expect(parts).toEqual(['integrations', 'user-123', '', 'openai.apiKey'])
    })

    it('preserves workflowId when present', () => {
      const ad = adBuilder.buildForLLMField('user-123', 'workflow-789', 'claude.apiKey')

      const parts = parseAD(ad)
      expect(parts).toEqual(['integrations', 'user-123', 'workflow-789', 'claude.apiKey'])
    })
  })

  describe('buildForArrayField', () => {
    it('builds AD with all parts present', () => {
      const ad = adBuilder.buildForArrayField('user-123', 'workflow-456', 'mcp', 'my-server', 'headers')

      const parts = parseAD(ad)
      expect(parts).toEqual(['integrations', 'user-123', 'workflow-456', 'mcp', 'my-server', 'headers'])
    })

    it('normalizes null workflowId to empty string', () => {
      const ad = adBuilder.buildForArrayField('user-123', null, 'rpc', 'ssh-host', 'privateKey')

      const parts = parseAD(ad)
      expect(parts).toEqual(['integrations', 'user-123', '', 'rpc', 'ssh-host', 'privateKey'])
    })
  })

  describe('byte format', () => {
    it('produces correct binary format for single part', () => {
      const ad = adBuilder.build('test')

      expect(ad.readUInt32BE(0)).toBe(4)
      expect(ad.toString('utf8', 4, 8)).toBe('test')
    })

    it('produces correct binary format for multiple parts', () => {
      const ad = adBuilder.build('part1', 'part2')

      const length1 = ad.readUInt32BE(0)
      expect(length1).toBe(5)
      expect(ad.toString('utf8', 4, 9)).toBe('part1')

      const length2 = ad.readUInt32BE(9)
      expect(length2).toBe(5)
      expect(ad.toString('utf8', 13, 18)).toBe('part2')
    })

    it('handles empty parts correctly', () => {
      const ad = adBuilder.build('before', '', 'after')

      const parts = parseAD(ad)
      expect(parts).toEqual(['before', '', 'after'])
    })

    it('handles UTF-8 correctly', () => {
      const ad = adBuilder.build('user-🔒', 'field-名前')

      const parts = parseAD(ad)
      expect(parts).toEqual(['user-🔒', 'field-名前'])
    })
  })

  describe('cross-backend compatibility', () => {
    it('produces deterministic output for same inputs', () => {
      const ad1 = adBuilder.buildForLLMField('user-123', 'workflow-456', 'openai.apiKey')
      const ad2 = adBuilder.buildForLLMField('user-123', 'workflow-456', 'openai.apiKey')

      expect(ad1.equals(ad2)).toBe(true)
    })

    it('produces different output for different users', () => {
      const ad1 = adBuilder.buildForLLMField('user-A', 'workflow-1', 'openai.apiKey')
      const ad2 = adBuilder.buildForLLMField('user-B', 'workflow-1', 'openai.apiKey')

      expect(ad1.equals(ad2)).toBe(false)
    })

    it('produces different output for different workflows', () => {
      const ad1 = adBuilder.buildForLLMField('user-1', 'workflow-A', 'openai.apiKey')
      const ad2 = adBuilder.buildForLLMField('user-1', 'workflow-B', 'openai.apiKey')

      expect(ad1.equals(ad2)).toBe(false)
    })

    it('produces different output for different fields', () => {
      const ad1 = adBuilder.buildForLLMField('user-1', 'workflow-1', 'openai.apiKey')
      const ad2 = adBuilder.buildForLLMField('user-1', 'workflow-1', 'claude.apiKey')

      expect(ad1.equals(ad2)).toBe(false)
    })

    it('produces different output for user-level vs workflow-scoped', () => {
      const ad1 = adBuilder.buildForLLMField('user-1', null, 'openai.apiKey')
      const ad2 = adBuilder.buildForLLMField('user-1', 'workflow-1', 'openai.apiKey')

      expect(ad1.equals(ad2)).toBe(false)
    })
  })

  describe('Go compatibility', () => {
    it('produces identical bytes to Go implementation for LLM field', () => {
      const ad = adBuilder.buildForLLMField('user-123', 'workflow-456', 'openai.apiKey')

      const expectedFromGo = Buffer.from([
        0x00,
        0x00,
        0x00,
        0x0c, // length: 12
        0x69,
        0x6e,
        0x74,
        0x65,
        0x67,
        0x72,
        0x61,
        0x74,
        0x69,
        0x6f,
        0x6e,
        0x73, // "integrations"
        0x00,
        0x00,
        0x00,
        0x08, // length: 8
        0x75,
        0x73,
        0x65,
        0x72,
        0x2d,
        0x31,
        0x32,
        0x33, // "user-123"
        0x00,
        0x00,
        0x00,
        0x0c, // length: 12
        0x77,
        0x6f,
        0x72,
        0x6b,
        0x66,
        0x6c,
        0x6f,
        0x77,
        0x2d,
        0x34,
        0x35,
        0x36, // "workflow-456"
        0x00,
        0x00,
        0x00,
        0x0d, // length: 13
        0x6f,
        0x70,
        0x65,
        0x6e,
        0x61,
        0x69,
        0x2e,
        0x61,
        0x70,
        0x69,
        0x4b,
        0x65,
        0x79, // "openai.apiKey"
      ])

      expect(ad.equals(expectedFromGo)).toBe(true)
    })

    it('produces identical bytes to Go implementation for array field', () => {
      const ad = adBuilder.buildForArrayField('user-1', null, 'mcp', 'srv', 'headers')

      const expectedFromGo = Buffer.from([
        0x00,
        0x00,
        0x00,
        0x0c, // length: 12
        0x69,
        0x6e,
        0x74,
        0x65,
        0x67,
        0x72,
        0x61,
        0x74,
        0x69,
        0x6f,
        0x6e,
        0x73, // "integrations"
        0x00,
        0x00,
        0x00,
        0x06, // length: 6
        0x75,
        0x73,
        0x65,
        0x72,
        0x2d,
        0x31, // "user-1"
        0x00,
        0x00,
        0x00,
        0x00, // length: 0 (empty workflowId)
        0x00,
        0x00,
        0x00,
        0x03, // length: 3
        0x6d,
        0x63,
        0x70, // "mcp"
        0x00,
        0x00,
        0x00,
        0x03, // length: 3
        0x73,
        0x72,
        0x76, // "srv"
        0x00,
        0x00,
        0x00,
        0x07, // length: 7
        0x68,
        0x65,
        0x61,
        0x64,
        0x65,
        0x72,
        0x73, // "headers"
      ])

      expect(ad.equals(expectedFromGo)).toBe(true)
    })
  })
})

function parseAD(ad) {
  const parts = []
  let offset = 0

  while (offset < ad.length) {
    if (offset + 4 > ad.length) break

    const length = ad.readUInt32BE(offset)
    offset += 4

    if (offset + length > ad.length) break

    const part = ad.toString('utf8', offset, offset + length)
    parts.push(part)
    offset += length
  }

  return parts
}

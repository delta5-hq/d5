import {escapeForJson} from './escapeForJson'

describe('escapeForJson', () => {
  describe('structural character escaping', () => {
    it('escapes double quotes', () => {
      expect(escapeForJson('say "hello"')).toBe('say \\"hello\\"')
    })

    it('escapes consecutive double quotes', () => {
      expect(escapeForJson('""')).toBe('\\"\\"')
    })

    it('escapes backslashes', () => {
      expect(escapeForJson('C:\\path')).toBe('C:\\\\path')
    })

    it('escapes consecutive backslashes', () => {
      expect(escapeForJson('\\\\')).toBe('\\\\\\\\')
    })

    it('escapes backslash before quote', () => {
      expect(escapeForJson('\\"')).toBe('\\\\\\"')
    })
  })

  describe('control character escaping', () => {
    it('escapes newlines (LF)', () => {
      expect(escapeForJson('line1\nline2')).toBe('line1\\nline2')
    })

    it('escapes carriage returns (CR)', () => {
      expect(escapeForJson('line1\rline2')).toBe('line1\\rline2')
    })

    it('escapes CRLF sequences', () => {
      expect(escapeForJson('line1\r\nline2')).toBe('line1\\r\\nline2')
    })

    it('escapes tabs', () => {
      expect(escapeForJson('col1\tcol2')).toBe('col1\\tcol2')
    })

    it('escapes form feeds', () => {
      expect(escapeForJson('page1\fpage2')).toBe('page1\\fpage2')
    })

    it('escapes backspaces', () => {
      expect(escapeForJson('test\btest')).toBe('test\\btest')
    })
  })

  describe('combined escaping scenarios', () => {
    it('handles multiple escape sequences', () => {
      const input = 'path: "C:\\Users"\n\ttab and quote'
      expect(escapeForJson(input)).toBe('path: \\"C:\\\\Users\\"\\n\\ttab and quote')
    })

    it('escapes JSON string content', () => {
      const input = '{"key": "value"}'
      expect(escapeForJson(input)).toBe('{\\"key\\": \\"value\\"}')
    })

    it('handles multiline JSON-like content', () => {
      const input = '{\n\t"key": "value"\n}'
      expect(escapeForJson(input)).toBe('{\\n\\t\\"key\\": \\"value\\"\\n}')
    })

    it('escapes all control characters together', () => {
      const input = 'a\nb\rc\td\fe\bf'
      expect(escapeForJson(input)).toBe('a\\nb\\rc\\td\\fe\\bf')
    })
  })

  describe('preservation of safe characters', () => {
    it('preserves alphanumeric characters', () => {
      expect(escapeForJson('abc123XYZ')).toBe('abc123XYZ')
    })

    it('preserves spaces', () => {
      expect(escapeForJson('hello world')).toBe('hello world')
    })

    it('preserves single quotes', () => {
      expect(escapeForJson("it's fine")).toBe("it's fine")
    })

    it('preserves common punctuation', () => {
      expect(escapeForJson('Hello, world! How are you?')).toBe('Hello, world! How are you?')
    })

    it('preserves unicode characters', () => {
      expect(escapeForJson('Hello 世界 🌍')).toBe('Hello 世界 🌍')
    })
  })

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(escapeForJson('')).toBe('')
    })

    it('handles string with only escapable characters', () => {
      expect(escapeForJson('"\\\n\r\t\f\b')).toBe('\\"\\\\\\n\\r\\t\\f\\b')
    })

    it('handles very long strings efficiently', () => {
      const long = 'a\n'.repeat(1000)
      const start = Date.now()
      const escaped = escapeForJson(long)
      const duration = Date.now() - start
      expect(escaped).toContain('\\n')
      expect(duration).toBeLessThan(100)
    })
  })

  describe('JSON validity verification', () => {
    it('produces valid JSON when wrapped in quotes', () => {
      const inputs = ['hello world', 'path: C:\\Users', 'line1\nline2', 'tab\there', 'quote "inside"']

      inputs.forEach(input => {
        const escaped = escapeForJson(input)
        const jsonString = `{"value": "${escaped}"}`
        expect(() => JSON.parse(jsonString)).not.toThrow()
      })
    })

    it('round-trips correctly through JSON parse', () => {
      const original = 'Test: "quote" backslash\\ newline\n tab\t'
      const escaped = escapeForJson(original)
      const jsonString = `{"text": "${escaped}"}`
      const parsed = JSON.parse(jsonString)
      expect(parsed.text).toBe(original)
    })
  })
})

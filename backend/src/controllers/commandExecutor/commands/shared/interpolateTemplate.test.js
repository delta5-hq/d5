import {interpolateTemplate} from './interpolateTemplate'

describe('interpolateTemplate', () => {
  describe('shell escape mode (default)', () => {
    it('replaces {{prompt}} placeholder', () => {
      expect(interpolateTemplate('echo "{{prompt}}"', 'hello')).toBe('echo "hello"')
    })

    it('replaces multiple occurrences', () => {
      expect(interpolateTemplate('{{prompt}} and {{prompt}}', 'test')).toBe('test and test')
    })

    it('escapes single quotes for shell safety', () => {
      const result = interpolateTemplate("echo '{{prompt}}'", "it's")
      expect(result).toBe("echo 'it'\\''s'")
    })

    it('handles empty prompt', () => {
      expect(interpolateTemplate('cmd {{prompt}}', '')).toBe('cmd ')
    })

    it('handles template without placeholder', () => {
      expect(interpolateTemplate('no placeholder', 'prompt')).toBe('no placeholder')
    })

    it('returns empty string for empty template', () => {
      expect(interpolateTemplate('', 'prompt')).toBe('')
    })
  })

  describe('json escape mode', () => {
    it('replaces {{prompt}} placeholder', () => {
      const result = interpolateTemplate('{"text":"{{prompt}}"}', 'hello', {escapeMode: 'json'})
      expect(result).toBe('{"text":"hello"}')
    })

    it('escapes double quotes', () => {
      const result = interpolateTemplate('{"text":"{{prompt}}"}', 'say "hi"', {escapeMode: 'json'})
      expect(result).toBe('{"text":"say \\"hi\\""}')
    })

    it('escapes backslashes', () => {
      const result = interpolateTemplate('{"path":"{{prompt}}"}', 'C:\\path', {escapeMode: 'json'})
      expect(result).toBe('{"path":"C:\\\\path"}')
    })

    it('escapes newlines', () => {
      const result = interpolateTemplate('{"text":"{{prompt}}"}', 'line1\nline2', {escapeMode: 'json'})
      expect(result).toBe('{"text":"line1\\nline2"}')
    })

    it('escapes carriage returns', () => {
      const result = interpolateTemplate('{"text":"{{prompt}}"}', 'line1\rline2', {escapeMode: 'json'})
      expect(result).toBe('{"text":"line1\\rline2"}')
    })
  })
})

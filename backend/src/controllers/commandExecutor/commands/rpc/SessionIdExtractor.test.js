import {SessionIdExtractor} from './SessionIdExtractor'

describe('SessionIdExtractor', () => {
  describe('extract with json format', () => {
    it('extracts session_id from top-level field by default', () => {
      const extractor = new SessionIdExtractor('json')
      const output = JSON.stringify({session_id: 'abc123', result: 'data'})

      expect(extractor.extract(output)).toBe('abc123')
    })

    it('extracts from nested path when outputField is specified', () => {
      const extractor = new SessionIdExtractor('json', 'meta.session_id')
      const output = JSON.stringify({meta: {session_id: 'nested-id'}, result: 'data'})

      expect(extractor.extract(output)).toBe('nested-id')
    })

    it('returns null when field does not exist', () => {
      const extractor = new SessionIdExtractor('json')
      const output = JSON.stringify({result: 'data'})

      expect(extractor.extract(output)).toBeNull()
    })

    it('returns null when nested path does not exist', () => {
      const extractor = new SessionIdExtractor('json', 'meta.missing.session_id')
      const output = JSON.stringify({meta: {other: 'value'}})

      expect(extractor.extract(output)).toBeNull()
    })

    it('returns null when field value is not a string', () => {
      const extractor = new SessionIdExtractor('json')
      const output = JSON.stringify({session_id: 123})

      expect(extractor.extract(output)).toBeNull()
    })

    it('returns null when field value is null', () => {
      const extractor = new SessionIdExtractor('json')
      const output = JSON.stringify({session_id: null})

      expect(extractor.extract(output)).toBeNull()
    })

    it('returns null when JSON is malformed', () => {
      const extractor = new SessionIdExtractor('json')
      const output = 'not valid json'

      expect(extractor.extract(output)).toBeNull()
    })

    it('handles deeply nested paths', () => {
      const extractor = new SessionIdExtractor('json', 'a.b.c.d.session_id')
      const output = JSON.stringify({a: {b: {c: {d: {session_id: 'deep-id'}}}}})

      expect(extractor.extract(output)).toBe('deep-id')
    })

    it('extracts from custom field name', () => {
      const extractor = new SessionIdExtractor('json', 'sessionToken')
      const output = JSON.stringify({sessionToken: 'custom-token-123'})

      expect(extractor.extract(output)).toBe('custom-token-123')
    })
  })

  describe('extract with text format', () => {
    it('returns null for text format output', () => {
      const extractor = new SessionIdExtractor('text')
      const output = 'session_id: abc123'

      expect(extractor.extract(output)).toBeNull()
    })

    it('returns null even if output looks like JSON', () => {
      const extractor = new SessionIdExtractor('text')
      const output = JSON.stringify({session_id: 'abc123'})

      expect(extractor.extract(output)).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('handles empty string output', () => {
      const extractor = new SessionIdExtractor('json')
      expect(extractor.extract('')).toBeNull()
    })

    it('handles empty object', () => {
      const extractor = new SessionIdExtractor('json')
      expect(extractor.extract('{}')).toBeNull()
    })

    it('handles array root (not an object)', () => {
      const extractor = new SessionIdExtractor('json')
      const output = JSON.stringify([{session_id: 'id1'}])

      expect(extractor.extract(output)).toBeNull()
    })

    it('extracts from array element when path includes index', () => {
      const extractor = new SessionIdExtractor('json', '0.session_id')
      const output = JSON.stringify([{session_id: 'array-id'}])

      expect(extractor.extract(output)).toBe('array-id')
    })

    it('handles whitespace in session_id value', () => {
      const extractor = new SessionIdExtractor('json')
      const output = JSON.stringify({session_id: '  spaced-id  '})

      expect(extractor.extract(output)).toBe('  spaced-id  ')
    })

    it('handles special characters in session_id value', () => {
      const extractor = new SessionIdExtractor('json')
      const output = JSON.stringify({session_id: 'id-with-special_chars.123'})

      expect(extractor.extract(output)).toBe('id-with-special_chars.123')
    })
  })
})

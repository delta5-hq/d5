import escapeRegexString from './escapeRegexString'

describe('escapeRegexString', () => {
  // Basic functionality tests
  it('should return an empty string when given an empty string', () => {
    expect(escapeRegexString('')).toBe('')
  })

  it('should not change strings without special regex characters', () => {
    expect(escapeRegexString('simple')).toBe('simple')
    expect(escapeRegexString('SimpleString123')).toBe('SimpleString123')
    expect(escapeRegexString('with spaces')).toBe('with spaces')
  })

  it('should escape all special regex characters', () => {
    // Testing all special characters individually
    expect(escapeRegexString('.')).toBe('\\.')
    expect(escapeRegexString('*')).toBe('\\*')
    expect(escapeRegexString('+')).toBe('\\+')
    expect(escapeRegexString('?')).toBe('\\?')
    expect(escapeRegexString('^')).toBe('\\^')
    expect(escapeRegexString('$')).toBe('\\$')
    expect(escapeRegexString('{')).toBe('\\{')
    expect(escapeRegexString('}')).toBe('\\}')
    expect(escapeRegexString('(')).toBe('\\(')
    expect(escapeRegexString(')')).toBe('\\)')
    expect(escapeRegexString('|')).toBe('\\|')
    expect(escapeRegexString('[')).toBe('\\[')
    expect(escapeRegexString(']')).toBe('\\]')
    expect(escapeRegexString('\\')).toBe('\\\\')

    // Testing all special characters combined
    expect(escapeRegexString('.*+?^${}()|[]\\')).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\')
  })

  // Mixed content tests
  it('should escape special characters within regular text', () => {
    expect(escapeRegexString('a.b*c')).toBe('a\\.b\\*c')
    expect(escapeRegexString('hello (world)')).toBe('hello \\(world\\)')
    expect(escapeRegexString('price: $10.99')).toBe('price: \\$10\\.99')
    expect(escapeRegexString('match [this] {pattern}')).toBe('match \\[this\\] \\{pattern\\}')
  })

  // Practical usage tests
  it('should create regex-safe strings that work in new RegExp()', () => {
    const text = 'hello.world'
    const escaped = escapeRegexString(text)
    const regex = new RegExp(escaped)

    expect(regex.test(text)).toBe(true)
    expect(regex.test('helloXworld')).toBe(false)
  })

  it('should properly handle complex patterns', () => {
    const pattern = 'function(arg1, arg2) { return arg1 + arg2; }'
    const escaped = escapeRegexString(pattern)

    expect(escaped).toBe('function\\(arg1, arg2\\) \\{ return arg1 \\+ arg2; \\}')

    const regex = new RegExp(escaped)
    expect(regex.test(pattern)).toBe(true)
  })

  // Edge cases
  it('should handle repeated special characters', () => {
    expect(escapeRegexString('...**??')).toBe('\\.\\.\\.\\*\\*\\?\\?')
  })

  it('should handle strings with existing escaped characters', () => {
    expect(escapeRegexString('already\\escaped')).toBe('already\\\\escaped')
  })

  // Unicode and international character tests
  it('should handle Unicode and international characters correctly', () => {
    // Unicode characters aren't regex special chars, so they shouldn't be escaped
    expect(escapeRegexString('你好，世界')).toBe('你好，世界')
    expect(escapeRegexString('こんにちは')).toBe('こんにちは')
    expect(escapeRegexString('안녕하세요')).toBe('안녕하세요')

    // Mix of Unicode and special characters
    expect(escapeRegexString('你好 (world)')).toBe('你好 \\(world\\)')
  })

  // Boundary tests
  it('should handle special characters at string boundaries', () => {
    expect(escapeRegexString('.start')).toBe('\\.start')
    expect(escapeRegexString('end.')).toBe('end\\.')
    expect(escapeRegexString('$.middle.$')).toBe('\\$\\.middle\\.\\$')
  })
})

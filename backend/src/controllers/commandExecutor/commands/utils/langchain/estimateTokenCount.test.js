import {estimateTokenCount} from './estimateTokenCount'

describe('estimateTokenCount', () => {
  it('should estimate token count for a simple sentence', () => {
    const text = 'The quick brown fox jumps over the lazy dog'
    expect(estimateTokenCount(text)).toBe(8)
  })

  it('should return 0 for an empty string', () => {
    expect(estimateTokenCount('')).toBe(0)
  })

  it('should handle multiple spaces correctly', () => {
    const text = '   The quick    brown  fox   '
    expect(estimateTokenCount(text)).toBe(4)
  })

  it('should handle single word correctly', () => {
    expect(estimateTokenCount('word')).toBe(1)
  })

  it('should handle special characters', () => {
    const text = "Hello, world! How's everything?"
    expect(estimateTokenCount(text)).toBe(5)
  })

  it('should handle numbers correctly', () => {
    const text = '123 456 789'
    expect(estimateTokenCount(text)).toBe(2)
  })

  it('should return consistent results for similar inputs', () => {
    const text1 = 'This is a test'
    const text2 = 'This is a    test'
    expect(estimateTokenCount(text1)).toBe(3)
    expect(estimateTokenCount(text2)).toBe(3)
  })

  it('should estimate token count for a long text accurately', () => {
    const text = 'word '.repeat(1000).trim()
    expect(estimateTokenCount(text)).toBe(1007)
  })
})

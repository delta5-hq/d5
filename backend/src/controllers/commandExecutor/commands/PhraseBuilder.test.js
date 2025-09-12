import {PhraseBuilder} from './PhraseBuilder'

describe('PhraseBuilder', () => {
  it('should return empty result when no input is appended', () => {
    const builder = new PhraseBuilder(5)
    expect(builder.result()).toBe('')
  })

  it('should append words and separate with a period', () => {
    const builder = new PhraseBuilder(5)
    builder.appendChunks('This is a test')
    expect(builder.result()).toBe('This is a test.')
  })

  it('should correctly handle multiple sentences', () => {
    const builder = new PhraseBuilder(10)
    builder.appendChunks('This is a test. Another test.')
    expect(builder.result()).toBe('This is a test. Another test.')
  })

  it('should respect word count limit', () => {
    const builder = new PhraseBuilder(3)
    const isFull = builder.appendChunks('One two three four five')
    expect(isFull).toBe(true)
    expect(builder.result()).toBe('One two three')
  })

  it('should handle leading and trailing spaces', () => {
    const builder = new PhraseBuilder(5)
    builder.appendChunks('   This   is   a   test   ')
    expect(builder.result()).toBe('This is a test.')
  })

  it('should handle empty input', () => {
    const builder = new PhraseBuilder(5)
    const isFull = builder.appendChunks('')
    expect(isFull).toBe(false)
    expect(builder.result()).toBe('')
  })

  it('should handle punctuation properly', () => {
    const builder = new PhraseBuilder(5)
    builder.appendChunks('This is a test. And another test.')
    expect(builder.result()).toBe('This is a test. And')
  })

  it('should stop appending when full', () => {
    const builder = new PhraseBuilder(5)
    builder.appendChunks('One two three four five six')
    expect(builder.isFull()).toBe(true)
    expect(builder.result()).toBe('One two three four five')
  })

  it('should append multiple times until full', () => {
    const builder = new PhraseBuilder(5)
    builder.appendChunks('One two')
    builder.appendChunks('three four five')
    expect(builder.isFull()).toBe(true)
    expect(builder.result()).toBe('One two. three four five')
  })

  it('should reset buffer and word count after calling result', () => {
    const builder = new PhraseBuilder(5)
    builder.appendChunks('One two three four five')
    builder.result()
    expect(builder.isFull()).toBe(false)
    expect(builder.result()).toBe('')
  })
})

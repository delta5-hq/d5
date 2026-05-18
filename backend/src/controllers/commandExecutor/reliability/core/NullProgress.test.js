import NullProgress from './NullProgress'

describe('NullProgress', () => {
  it('should implement ProgressReporter interface', () => {
    const progress = new NullProgress()

    expect(typeof progress.add).toBe('function')
    expect(typeof progress.remove).toBe('function')
    expect(typeof progress.dispose).toBe('function')
    expect(typeof progress.registerChild).toBe('function')
  })

  it('should return empty string from add', async () => {
    const progress = new NullProgress()

    const result = await progress.add('task')

    expect(result).toBe('')
  })

  it('should accept null/undefined arguments without throwing', async () => {
    const progress = new NullProgress()

    await expect(progress.add(null)).resolves.toBe('')
    expect(() => progress.remove(undefined)).not.toThrow()
    expect(() => progress.registerChild()).not.toThrow()
  })

  it('should support concurrent operations', async () => {
    const progress = new NullProgress()

    const results = await Promise.all([progress.add('a'), progress.add('b'), progress.add('c')])

    expect(results).toEqual(['', '', ''])
  })

  it('should allow disposal without cleanup', () => {
    const progress = new NullProgress()

    progress.add('task')
    expect(() => progress.dispose()).not.toThrow()
    expect(() => progress.dispose()).not.toThrow()
  })
})

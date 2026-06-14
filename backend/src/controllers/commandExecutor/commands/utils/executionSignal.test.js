import {createAbortError, isAbortError, signalOptions, throwIfAbortError, throwIfAborted} from './executionSignal'

describe('executionSignal', () => {
  it('creates a standard AbortError recognizable by execution boundaries', () => {
    const error = createAbortError()

    expect(error).toMatchObject({name: 'AbortError', message: 'Operation cancelled'})
    expect(isAbortError(error)).toBe(true)
  })

  it.each([
    ['absent signal', undefined],
    ['live signal', new AbortController().signal],
  ])('does not throw for %s', (_label, signal) => {
    expect(() => throwIfAborted(signal)).not.toThrow()
  })

  it('throws AbortError when the signal is already aborted', () => {
    const controller = new AbortController()
    controller.abort()

    expect(() => throwIfAborted(controller.signal)).toThrow('Operation cancelled')
    expect(() => throwIfAborted(controller.signal)).toThrow(expect.objectContaining({name: 'AbortError'}))
  })

  it.each([
    ['AbortError instance', createAbortError(), true],
    ['plain error', new Error('boom'), false],
    ['null', null, false],
    ['undefined', undefined, false],
  ])('classifies %s', (_label, error, expected) => {
    expect(isAbortError(error)).toBe(expected)
  })

  it('rethrows AbortError before command error-node handlers can swallow cancellation', () => {
    const error = createAbortError()

    expect(() => throwIfAbortError(error)).toThrow(error)
  })

  it('ignores non-abort errors in command error-node handlers', () => {
    expect(() => throwIfAbortError(new Error('ordinary failure'))).not.toThrow()
  })

  it('returns invocation options only when a signal exists', () => {
    const signal = new AbortController().signal

    expect(signalOptions()).toBeUndefined()
    expect(signalOptions(signal)).toEqual({signal})
  })
})

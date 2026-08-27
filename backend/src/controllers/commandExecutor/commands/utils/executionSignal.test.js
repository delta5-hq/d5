import {createAbortError, isAbortError, signalOptions, throwIfAbortError, throwIfAborted} from './executionSignal'

describe('executionSignal', () => {
  describe('createAbortError', () => {
    it('produces an Error with AbortError name and standard cancellation message', () => {
      expect(createAbortError()).toMatchObject({name: 'AbortError', message: 'Operation cancelled'})
    })

    it('returns a distinct instance on each call', () => {
      expect(createAbortError()).not.toBe(createAbortError())
    })
  })

  describe('isAbortError', () => {
    it.each([
      ['AbortError produced by createAbortError', createAbortError(), true],
      ['duck-typed plain object with AbortError name', {name: 'AbortError'}, true],
      ['plain Error', new Error('boom'), false],
      ['null', null, false],
      ['undefined', undefined, false],
      ['object with undefined name', {name: undefined}, false],
    ])('classifies %s', (_label, error, expected) => {
      expect(isAbortError(error)).toBe(expected)
    })
  })

  describe('throwIfAbortError', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['plain Error', new Error('ordinary failure')],
    ])('does not throw for %s', (_label, error) => {
      expect(() => throwIfAbortError(error)).not.toThrow()
    })

    it('rethrows exactly the AbortError instance without wrapping', () => {
      const error = createAbortError()

      expect(() => throwIfAbortError(error)).toThrow(error)
    })
  })

  describe('throwIfAborted', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['a live signal', new AbortController().signal],
    ])('does not throw for %s', (_label, signal) => {
      expect(() => throwIfAborted(signal)).not.toThrow()
    })

    it('throws when the signal is already aborted', () => {
      const controller = new AbortController()
      controller.abort()

      expect(() => throwIfAborted(controller.signal)).toThrow('Operation cancelled')
      expect(() => throwIfAborted(controller.signal)).toThrow(expect.objectContaining({name: 'AbortError'}))
    })

    it('throws an error that isAbortError recognizes', () => {
      const controller = new AbortController()
      controller.abort()

      let caught
      try {
        throwIfAborted(controller.signal)
      } catch (e) {
        caught = e
      }

      expect(isAbortError(caught)).toBe(true)
    })
  })

  describe('signalOptions', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
    ])('returns undefined for %s', (_label, signal) => {
      expect(signalOptions(signal)).toBeUndefined()
    })

    it('wraps a present signal in an options object', () => {
      const signal = new AbortController().signal

      expect(signalOptions(signal)).toEqual({signal})
    })
  })
})

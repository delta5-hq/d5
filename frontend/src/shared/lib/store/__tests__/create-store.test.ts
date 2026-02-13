import { describe, it, expect, vi } from 'vitest'
import { createStore } from '../create-store'

interface TestState {
  count: number
  name: string
}

const initialState: TestState = { count: 0, name: 'init' }

describe('createStore', () => {
  it('returns initial state', () => {
    const store = createStore(initialState)
    expect(store.getState()).toEqual(initialState)
  })

  it('merges partial object updates', () => {
    const store = createStore(initialState)
    store.setState({ count: 5 })
    expect(store.getState()).toEqual({ count: 5, name: 'init' })
  })

  it('merges updater function results', () => {
    const store = createStore(initialState)
    store.setState(prev => ({ count: prev.count + 1 }))
    expect(store.getState().count).toBe(1)
  })

  it('notifies listeners on state change', () => {
    const store = createStore(initialState)
    const listener = vi.fn()

    store.subscribe(listener)
    store.setState({ count: 1 })

    expect(listener).toHaveBeenCalledOnce()
  })

  it('skips notification when state is unchanged', () => {
    const store = createStore({ count: 0 })
    const listener = vi.fn()

    store.subscribe(listener)
    store.setState({ count: 0 })

    expect(listener).not.toHaveBeenCalled()
  })

  it('unsubscribes listener', () => {
    const store = createStore(initialState)
    const listener = vi.fn()

    const unsub = store.subscribe(listener)
    unsub()
    store.setState({ count: 99 })

    expect(listener).not.toHaveBeenCalled()
  })

  it('clears all listeners on destroy', () => {
    const store = createStore(initialState)
    const listener = vi.fn()

    store.subscribe(listener)
    store.destroy()
    store.setState({ count: 99 })

    expect(listener).not.toHaveBeenCalled()
  })

  it('notifies multiple listeners', () => {
    const store = createStore(initialState)
    const l1 = vi.fn()
    const l2 = vi.fn()

    store.subscribe(l1)
    store.subscribe(l2)
    store.setState({ count: 1 })

    expect(l1).toHaveBeenCalledOnce()
    expect(l2).toHaveBeenCalledOnce()
  })

  it('skips notification when updater returns same values', () => {
    const store = createStore(initialState)
    const listener = vi.fn()

    store.subscribe(listener)
    store.setState(prev => ({ count: prev.count }))

    expect(listener).not.toHaveBeenCalled()
  })

  it('returns new reference after state change', () => {
    const store = createStore(initialState)
    const before = store.getState()

    store.setState({ count: 5 })
    const after = store.getState()

    expect(before).not.toBe(after)
  })

  it('handles NaN equality via Object.is', () => {
    const store = createStore({ value: NaN })
    const listener = vi.fn()

    store.subscribe(listener)
    store.setState({ value: NaN })

    expect(listener).not.toHaveBeenCalled()
  })

  it('still updates internal state after destroy', () => {
    const store = createStore(initialState)
    store.destroy()
    store.setState({ count: 42 })

    expect(store.getState().count).toBe(42)
  })

  it('handles multiple subscribe/unsubscribe cycles', () => {
    const store = createStore(initialState)
    const listener = vi.fn()

    const unsub1 = store.subscribe(listener)
    unsub1()
    const unsub2 = store.subscribe(listener)

    store.setState({ count: 1 })
    expect(listener).toHaveBeenCalledOnce()

    unsub2()
    store.setState({ count: 2 })
    expect(listener).toHaveBeenCalledOnce()
  })
})

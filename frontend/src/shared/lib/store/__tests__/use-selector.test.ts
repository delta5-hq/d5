import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createStore } from '../create-store'
import { useSelector } from '../use-selector'

interface TestState {
  count: number
  name: string
}

describe('useSelector', () => {
  it('selects a slice of state', () => {
    const store = createStore<TestState>({ count: 0, name: 'test' })

    const { result } = renderHook(() => useSelector(store, s => s.count))

    expect(result.current).toBe(0)
  })

  it('re-renders on selected slice change', () => {
    const store = createStore<TestState>({ count: 0, name: 'test' })

    const { result } = renderHook(() => useSelector(store, s => s.count))

    act(() => store.setState({ count: 5 }))

    expect(result.current).toBe(5)
  })

  it('skips re-render when unrelated state changes', () => {
    const store = createStore<TestState>({ count: 0, name: 'test' })
    let renderCount = 0

    renderHook(() => {
      renderCount++
      return useSelector(store, s => s.count)
    })

    const initial = renderCount
    act(() => store.setState({ name: 'changed' }))

    expect(renderCount).toBe(initial)
  })

  it('uses custom equality function', () => {
    const store = createStore({ items: [1, 2, 3] })
    let renderCount = 0

    const arrayEquals = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i])

    renderHook(() => {
      renderCount++
      return useSelector(store, s => s.items, arrayEquals)
    })

    const initial = renderCount
    act(() => store.setState({ items: [1, 2, 3] }))

    expect(renderCount).toBe(initial)
  })
})

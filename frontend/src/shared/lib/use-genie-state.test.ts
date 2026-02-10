import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { genieStateStore } from './genie-state-store'
import { useGenieState } from './use-genie-state'

describe('useGenieState', () => {
  beforeEach(() => {
    genieStateStore.clearAll()
  })

  it('returns idle for unset node', () => {
    const { result } = renderHook(() => useGenieState('node1'))
    expect(result.current).toBe('idle')
  })

  it('returns current state', () => {
    genieStateStore.setState('node1', 'busy')
    const { result } = renderHook(() => useGenieState('node1'))
    expect(result.current).toBe('busy')
  })

  it('updates when subscribed node state changes', () => {
    const { result } = renderHook(() => useGenieState('node1'))
    expect(result.current).toBe('idle')

    act(() => {
      genieStateStore.setState('node1', 'busy')
    })
    expect(result.current).toBe('busy')

    act(() => {
      genieStateStore.setState('node1', 'done-success')
    })
    expect(result.current).toBe('done-success')
  })

  it('does not re-render when other nodes change', () => {
    let renderCount = 0
    const { result } = renderHook(() => {
      renderCount++
      return useGenieState('node1')
    })

    expect(renderCount).toBe(1)
    expect(result.current).toBe('idle')

    act(() => {
      genieStateStore.setState('node2', 'busy')
      genieStateStore.setState('node3', 'done-success')
      genieStateStore.setState('node4', 'busy-alert')
    })

    expect(renderCount).toBe(1)
    expect(result.current).toBe('idle')
  })

  it('does not re-render when state set to same value', () => {
    let renderCount = 0
    renderHook(() => {
      renderCount++
      return useGenieState('node1')
    })

    expect(renderCount).toBe(1)

    act(() => {
      genieStateStore.setState('node1', 'busy')
    })
    expect(renderCount).toBe(2)

    act(() => {
      genieStateStore.setState('node1', 'busy')
      genieStateStore.setState('node1', 'busy')
    })
    expect(renderCount).toBe(2)
  })

  it('multiple hooks subscribe independently', () => {
    const { result: result1 } = renderHook(() => useGenieState('node1'))
    const { result: result2 } = renderHook(() => useGenieState('node2'))

    expect(result1.current).toBe('idle')
    expect(result2.current).toBe('idle')

    act(() => {
      genieStateStore.setState('node1', 'busy')
    })

    expect(result1.current).toBe('busy')
    expect(result2.current).toBe('idle')

    act(() => {
      genieStateStore.setState('node2', 'done-success')
    })

    expect(result1.current).toBe('busy')
    expect(result2.current).toBe('done-success')
  })

  it('cleans up subscription on unmount', () => {
    const { unmount } = renderHook(() => useGenieState('node1'))
    expect(genieStateStore.getListenerCount('node1')).toBe(1)

    unmount()
    expect(genieStateStore.getListenerCount('node1')).toBe(0)
  })
})

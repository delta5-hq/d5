import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { type ReactNode } from 'react'
import { TreeAnimationProvider, useTreeAnimation } from '../tree-animation-context'
import { scheduleTreeAnimation, resetTreeAnimationState } from '../../core/tree-animation-store'

const wrapper = ({ children }: { children: ReactNode }) => <TreeAnimationProvider>{children}</TreeAnimationProvider>

describe('TreeAnimationProvider — scheduleNewNodeFlash / consumeNewNodeFlash', () => {
  describe('scheduleNewNodeFlash', () => {
    it('marks a node so the first consume returns true', () => {
      const { result } = renderHook(() => useTreeAnimation(), { wrapper })
      result.current.scheduleNewNodeFlash('n1')
      expect(result.current.consumeNewNodeFlash('n1')).toBe(true)
    })

    it('scheduling multiple nodes marks each independently', () => {
      const { result } = renderHook(() => useTreeAnimation(), { wrapper })
      result.current.scheduleNewNodeFlash('a')
      result.current.scheduleNewNodeFlash('b')
      result.current.scheduleNewNodeFlash('c')
      expect(result.current.consumeNewNodeFlash('a')).toBe(true)
      expect(result.current.consumeNewNodeFlash('b')).toBe(true)
      expect(result.current.consumeNewNodeFlash('c')).toBe(true)
    })

    it('scheduling the same node twice is idempotent — consume still returns true once', () => {
      const { result } = renderHook(() => useTreeAnimation(), { wrapper })
      result.current.scheduleNewNodeFlash('n1')
      result.current.scheduleNewNodeFlash('n1')
      expect(result.current.consumeNewNodeFlash('n1')).toBe(true)
      expect(result.current.consumeNewNodeFlash('n1')).toBe(false)
    })
  })

  describe('consumeNewNodeFlash', () => {
    it('returns false for a node that was never scheduled', () => {
      const { result } = renderHook(() => useTreeAnimation(), { wrapper })
      expect(result.current.consumeNewNodeFlash('unscheduled')).toBe(false)
    })

    it('returns true exactly once then false on subsequent calls (consume-once semantics)', () => {
      const { result } = renderHook(() => useTreeAnimation(), { wrapper })
      result.current.scheduleNewNodeFlash('n1')
      expect(result.current.consumeNewNodeFlash('n1')).toBe(true)
      expect(result.current.consumeNewNodeFlash('n1')).toBe(false)
      expect(result.current.consumeNewNodeFlash('n1')).toBe(false)
    })

    it('consuming one node does not affect other scheduled nodes', () => {
      const { result } = renderHook(() => useTreeAnimation(), { wrapper })
      result.current.scheduleNewNodeFlash('a')
      result.current.scheduleNewNodeFlash('b')
      result.current.consumeNewNodeFlash('a')
      expect(result.current.consumeNewNodeFlash('b')).toBe(true)
    })

    it('consuming an unscheduled node does not throw', () => {
      const { result } = renderHook(() => useTreeAnimation(), { wrapper })
      expect(() => result.current.consumeNewNodeFlash('ghost')).not.toThrow()
    })
  })

  describe('isolation from spark animation state', () => {
    beforeEach(() => {
      resetTreeAnimationState()
    })

    it('scheduleNewNodeFlash does not affect shouldAnimate', () => {
      const { result } = renderHook(() => useTreeAnimation(), { wrapper })
      result.current.scheduleNewNodeFlash('n1')
      expect(result.current.shouldAnimate('n1')).toBe(false)
    })

    it('clearing spark animation does not consume new-node flash', () => {
      const { result } = renderHook(() => useTreeAnimation(), { wrapper })
      result.current.scheduleNewNodeFlash('n1')
      act(() => {
        scheduleTreeAnimation(['n1'], 0)
        result.current.clearAnimation('n1')
      })
      expect(result.current.consumeNewNodeFlash('n1')).toBe(true)
    })
  })
})

describe('TreeAnimationProvider — spark state delegation', () => {
  beforeEach(() => {
    resetTreeAnimationState()
  })

  it('delegates shouldAnimate to the shared tree animation store', () => {
    const { result } = renderHook(() => useTreeAnimation(), { wrapper })
    act(() => scheduleTreeAnimation(['a', 'b'], 10))
    expect(result.current.shouldAnimate('a')).toBe(true)
    expect(result.current.shouldAnimate('b')).toBe(true)
  })

  it('delegates getBaseDelay to the shared tree animation store', () => {
    const { result } = renderHook(() => useTreeAnimation(), { wrapper })
    act(() => scheduleTreeAnimation(['n1'], 42))
    expect(result.current.getBaseDelay('n1')).toBe(42)
  })

  it('returns 0 base delay for an unscheduled node', () => {
    const { result } = renderHook(() => useTreeAnimation(), { wrapper })
    expect(result.current.getBaseDelay('unknown')).toBe(0)
  })

  it('delegates elapsed time to the shared tree animation store', () => {
    const { result } = renderHook(() => useTreeAnimation(), { wrapper })
    expect(result.current.getElapsed('unknown')).toBe(0)
  })

  it('reacts when an existing row is scheduled after the provider mounted', () => {
    const { result } = renderHook(() => useTreeAnimation(), { wrapper })
    const initialVersion = result.current.animationVersion

    act(() => scheduleTreeAnimation(['already-mounted']))

    expect(result.current.animationVersion).toBeGreaterThan(initialVersion)
    expect(result.current.shouldAnimate('already-mounted')).toBe(true)
  })

  it('delegates clearAnimation to the shared tree animation store', () => {
    const { result } = renderHook(() => useTreeAnimation(), { wrapper })
    act(() => scheduleTreeAnimation(['n1'], 0))
    expect(result.current.shouldAnimate('n1')).toBe(true)
    act(() => result.current.clearAnimation('n1'))
    expect(result.current.shouldAnimate('n1')).toBe(false)
  })

  it('does not expose scheduleAnimation — scheduling lives in the store', () => {
    const { result } = renderHook(() => useTreeAnimation(), { wrapper })
    expect('scheduleAnimation' in result.current).toBe(false)
  })
})

describe('useTreeAnimation — provider boundary', () => {
  it('throws when used outside TreeAnimationProvider', () => {
    expect(() => renderHook(() => useTreeAnimation())).toThrow(
      'useTreeAnimation must be used within TreeAnimationProvider',
    )
  })
})

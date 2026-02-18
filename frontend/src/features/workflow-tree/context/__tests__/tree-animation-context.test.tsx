import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { type ReactNode } from 'react'
import { TreeAnimationProvider, useTreeAnimation } from '../tree-animation-context'

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
    it('scheduleNewNodeFlash does not affect shouldAnimate', () => {
      const { result } = renderHook(() => useTreeAnimation(), { wrapper })
      result.current.scheduleNewNodeFlash('n1')
      expect(result.current.shouldAnimate('n1')).toBe(false)
    })

    it('scheduleAnimation does not affect consumeNewNodeFlash', () => {
      const { result } = renderHook(() => useTreeAnimation(), { wrapper })
      result.current.scheduleAnimation(['n1'], 0)
      expect(result.current.consumeNewNodeFlash('n1')).toBe(false)
    })

    it('clearing spark animation does not consume new-node flash', () => {
      const { result } = renderHook(() => useTreeAnimation(), { wrapper })
      result.current.scheduleNewNodeFlash('n1')
      result.current.scheduleAnimation(['n1'], 0)
      result.current.clearAnimation('n1')
      expect(result.current.consumeNewNodeFlash('n1')).toBe(true)
    })
  })
})

describe('TreeAnimationProvider — scheduleAnimation / shouldAnimate / getBaseDelay / clearAnimation', () => {
  describe('scheduleAnimation', () => {
    it('marks nodes as needing animation', () => {
      const { result } = renderHook(() => useTreeAnimation(), { wrapper })
      result.current.scheduleAnimation(['a', 'b'], 10)
      expect(result.current.shouldAnimate('a')).toBe(true)
      expect(result.current.shouldAnimate('b')).toBe(true)
    })

    it('stores the provided baseDelay for each node', () => {
      const { result } = renderHook(() => useTreeAnimation(), { wrapper })
      result.current.scheduleAnimation(['n1'], 42)
      expect(result.current.getBaseDelay('n1')).toBe(42)
    })

    it('scheduling an empty array is a no-op', () => {
      const { result } = renderHook(() => useTreeAnimation(), { wrapper })
      expect(() => result.current.scheduleAnimation([], 0)).not.toThrow()
    })

    it('later schedule for same node overwrites previous baseDelay', () => {
      const { result } = renderHook(() => useTreeAnimation(), { wrapper })
      result.current.scheduleAnimation(['n1'], 5)
      result.current.scheduleAnimation(['n1'], 99)
      expect(result.current.getBaseDelay('n1')).toBe(99)
    })
  })

  describe('shouldAnimate', () => {
    it('returns false for unscheduled node', () => {
      const { result } = renderHook(() => useTreeAnimation(), { wrapper })
      expect(result.current.shouldAnimate('unknown')).toBe(false)
    })

    it('returns true after scheduling and false after clearing', () => {
      const { result } = renderHook(() => useTreeAnimation(), { wrapper })
      result.current.scheduleAnimation(['n1'], 0)
      expect(result.current.shouldAnimate('n1')).toBe(true)
      result.current.clearAnimation('n1')
      expect(result.current.shouldAnimate('n1')).toBe(false)
    })
  })

  describe('getBaseDelay', () => {
    it('returns 0 for an unscheduled node', () => {
      const { result } = renderHook(() => useTreeAnimation(), { wrapper })
      expect(result.current.getBaseDelay('unknown')).toBe(0)
    })

    it('returns the stored delay after scheduling', () => {
      const { result } = renderHook(() => useTreeAnimation(), { wrapper })
      result.current.scheduleAnimation(['n1'], 7)
      expect(result.current.getBaseDelay('n1')).toBe(7)
    })

    it('multiple nodes can have different base delays', () => {
      const { result } = renderHook(() => useTreeAnimation(), { wrapper })
      result.current.scheduleAnimation(['a'], 10)
      result.current.scheduleAnimation(['b'], 20)
      expect(result.current.getBaseDelay('a')).toBe(10)
      expect(result.current.getBaseDelay('b')).toBe(20)
    })
  })

  describe('clearAnimation', () => {
    it('removes node from pending set', () => {
      const { result } = renderHook(() => useTreeAnimation(), { wrapper })
      result.current.scheduleAnimation(['n1'], 0)
      result.current.clearAnimation('n1')
      expect(result.current.shouldAnimate('n1')).toBe(false)
    })

    it('clearing an unscheduled node does not throw', () => {
      const { result } = renderHook(() => useTreeAnimation(), { wrapper })
      expect(() => result.current.clearAnimation('ghost')).not.toThrow()
    })

    it('clearing one node does not affect other scheduled nodes', () => {
      const { result } = renderHook(() => useTreeAnimation(), { wrapper })
      result.current.scheduleAnimation(['a', 'b'], 0)
      result.current.clearAnimation('a')
      expect(result.current.shouldAnimate('b')).toBe(true)
    })
  })
})

describe('useTreeAnimation — provider boundary', () => {
  it('throws when used outside TreeAnimationProvider', () => {
    expect(() => renderHook(() => useTreeAnimation())).toThrow(
      'useTreeAnimation must be used within TreeAnimationProvider',
    )
  })
})

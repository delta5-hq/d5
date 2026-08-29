import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  scheduleTreeAnimation,
  shouldAnimateTree,
  getPendingTreeAnimationNodeIds,
  getTreeAnimationBaseDelay,
  getTreeAnimationElapsedMs,
  getTreeAnimationStartDelayMs,
  getTreeAnimationRemainingDurationMs,
  getTreeAnimationVersion,
  subscribeTreeAnimation,
  clearTreeAnimation,
  resetTreeAnimationState,
} from '../tree-animation-store'

describe('tree-animation-store', () => {
  beforeEach(() => {
    resetTreeAnimationState()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('scheduleTreeAnimation', () => {
    it('marks nodes as needing animation', () => {
      scheduleTreeAnimation(['a', 'b'], 10)
      expect(shouldAnimateTree('a')).toBe(true)
      expect(shouldAnimateTree('b')).toBe(true)
      expect(getPendingTreeAnimationNodeIds()).toEqual(['a', 'b'])
    })

    it('stores the provided baseDelay for each node', () => {
      scheduleTreeAnimation(['n1'], 42)
      expect(getTreeAnimationBaseDelay('n1')).toBe(42)
    })

    it('defaults baseDelay to 0 when omitted', () => {
      scheduleTreeAnimation(['n1'])
      expect(getTreeAnimationBaseDelay('n1')).toBe(0)
    })

    it('scheduling an empty array is a no-op', () => {
      expect(() => scheduleTreeAnimation([], 0)).not.toThrow()
    })

    it('later schedule for same node overwrites previous baseDelay', () => {
      scheduleTreeAnimation(['n1'], 5)
      scheduleTreeAnimation(['n1'], 99)
      expect(getTreeAnimationBaseDelay('n1')).toBe(99)
    })
  })

  describe('shouldAnimateTree', () => {
    it('returns false for unscheduled node', () => {
      expect(shouldAnimateTree('unknown')).toBe(false)
    })

    it('returns true after scheduling and false after clearing', () => {
      scheduleTreeAnimation(['n1'], 0)
      expect(shouldAnimateTree('n1')).toBe(true)
      clearTreeAnimation('n1')
      expect(shouldAnimateTree('n1')).toBe(false)
    })
  })

  describe('getTreeAnimationBaseDelay', () => {
    it('returns 0 for an unscheduled node', () => {
      expect(getTreeAnimationBaseDelay('unknown')).toBe(0)
    })

    it('multiple nodes can have different base delays', () => {
      scheduleTreeAnimation(['a'], 10)
      scheduleTreeAnimation(['b'], 20)
      expect(getTreeAnimationBaseDelay('a')).toBe(10)
      expect(getTreeAnimationBaseDelay('b')).toBe(20)
    })
  })

  describe('getTreeAnimationElapsedMs', () => {
    it('tracks elapsed wall-clock time from scheduling', () => {
      vi.useFakeTimers()
      vi.setSystemTime(1_000)
      scheduleTreeAnimation(['n1'], 10)

      vi.advanceTimersByTime(250)

      expect(getTreeAnimationElapsedMs('n1')).toBe(250)
      expect(getTreeAnimationElapsedMs('unknown')).toBe(0)
    })
  })

  describe('target timing and subscriptions', () => {
    it('tracks target-specific start and fixed completion deadline', () => {
      vi.useFakeTimers()
      vi.setSystemTime(1_000)
      scheduleTreeAnimation(['n1'], 10, { n1: 200 })

      expect(getTreeAnimationStartDelayMs('n1')).toBe(200)
      expect(getTreeAnimationRemainingDurationMs('n1')).toBe(750)

      vi.advanceTimersByTime(300)

      expect(getTreeAnimationStartDelayMs('n1')).toBe(0)
      expect(getTreeAnimationRemainingDurationMs('n1')).toBe(650)
    })

    it('notifies subscribers when scheduling and clearing change the registry', () => {
      const listener = vi.fn()
      const initialVersion = getTreeAnimationVersion()
      const unsubscribe = subscribeTreeAnimation(listener)

      scheduleTreeAnimation(['n1'])
      expect(listener).toHaveBeenCalledTimes(1)
      expect(getTreeAnimationVersion()).toBe(initialVersion + 1)

      clearTreeAnimation('n1')
      expect(listener).toHaveBeenCalledTimes(2)
      unsubscribe()
    })
  })

  describe('clearTreeAnimation', () => {
    it('removes node from pending set', () => {
      scheduleTreeAnimation(['n1'], 0)
      clearTreeAnimation('n1')
      expect(shouldAnimateTree('n1')).toBe(false)
    })

    it('clearing an unscheduled node does not throw', () => {
      expect(() => clearTreeAnimation('ghost')).not.toThrow()
    })

    it('clearing one node does not affect other scheduled nodes', () => {
      scheduleTreeAnimation(['a', 'b'], 0)
      clearTreeAnimation('a')
      expect(shouldAnimateTree('b')).toBe(true)
    })
  })

  describe('resetTreeAnimationState', () => {
    it('clears all scheduled nodes', () => {
      scheduleTreeAnimation(['a', 'b'], 0)
      resetTreeAnimationState()
      expect(shouldAnimateTree('a')).toBe(false)
      expect(shouldAnimateTree('b')).toBe(false)
    })
  })
})

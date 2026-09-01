import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  scheduleTreeAnimation,
  shouldAnimateTree,
  getPendingTreeAnimationNodeIds,
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
      scheduleTreeAnimation(['a', 'b'])
      expect(shouldAnimateTree('a')).toBe(true)
      expect(shouldAnimateTree('b')).toBe(true)
      expect(getPendingTreeAnimationNodeIds()).toEqual(['a', 'b'])
    })

    it('scheduling an empty array is a no-op', () => {
      expect(() => scheduleTreeAnimation([])).not.toThrow()
    })
  })

  describe('shouldAnimateTree', () => {
    it('returns false for unscheduled node', () => {
      expect(shouldAnimateTree('unknown')).toBe(false)
    })

    it('returns true after scheduling and false after clearing', () => {
      scheduleTreeAnimation(['n1'])
      expect(shouldAnimateTree('n1')).toBe(true)
      clearTreeAnimation('n1')
      expect(shouldAnimateTree('n1')).toBe(false)
    })
  })

  describe('target timing and subscriptions', () => {
    it('tracks target-specific start and fixed completion deadline', () => {
      vi.useFakeTimers()
      vi.setSystemTime(1_000)
      scheduleTreeAnimation(['n1'], { n1: 200 })

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
      scheduleTreeAnimation(['n1'])
      clearTreeAnimation('n1')
      expect(shouldAnimateTree('n1')).toBe(false)
    })

    it('clearing an unscheduled node does not throw', () => {
      expect(() => clearTreeAnimation('ghost')).not.toThrow()
    })

    it('clearing one node does not affect other scheduled nodes', () => {
      scheduleTreeAnimation(['a', 'b'])
      clearTreeAnimation('a')
      expect(shouldAnimateTree('b')).toBe(true)
    })
  })

  describe('resetTreeAnimationState', () => {
    it('clears all scheduled nodes', () => {
      scheduleTreeAnimation(['a', 'b'])
      resetTreeAnimationState()
      expect(shouldAnimateTree('a')).toBe(false)
      expect(shouldAnimateTree('b')).toBe(false)
    })
  })
})

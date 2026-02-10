import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useNodeCacheCleanup } from '../use-node-cache-cleanup'
import { playerCache, RADIAL_FLASH_PREFIX } from '../player-cache'
import { genieStateStore } from '../genie-state-store'

const createMockPlayer = () => ({
  stop: vi.fn(),
  play: vi.fn(),
  pause: vi.fn(),
  destroy: vi.fn(),
  totalFrames: 60,
  frameRate: 30,
})

describe('useNodeCacheCleanup', () => {
  beforeEach(() => {
    playerCache.clear()
    genieStateStore.clearAll()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial mount', () => {
    it('does not reconcile on initial mount', () => {
      const player1 = createMockPlayer()
      playerCache.set(`${RADIAL_FLASH_PREFIX}node-1`, player1 as never)
      playerCache.set(`${RADIAL_FLASH_PREFIX}node-2`, createMockPlayer() as never)
      genieStateStore.setState('node-1', 'busy')
      genieStateStore.setState('node-2', 'done-success')

      renderHook(() => useNodeCacheCleanup(new Set(['node-1'])))

      expect(playerCache.size).toBe(2)
      expect(genieStateStore.getAllStates().size).toBe(2)
      expect(player1.stop).not.toHaveBeenCalled()
    })
  })

  describe('nodeIds change', () => {
    it('reconciles caches when nodeIds change', () => {
      const player1 = createMockPlayer()
      const player2 = createMockPlayer()
      playerCache.set(`${RADIAL_FLASH_PREFIX}node-1`, player1 as never)
      playerCache.set(`${RADIAL_FLASH_PREFIX}node-2`, player2 as never)
      genieStateStore.setState('node-1', 'busy')
      genieStateStore.setState('node-2', 'done-success')

      const { rerender } = renderHook(({ nodeIds }) => useNodeCacheCleanup(nodeIds), {
        initialProps: { nodeIds: new Set(['node-1', 'node-2']) },
      })

      expect(playerCache.size).toBe(2)

      rerender({ nodeIds: new Set(['node-1']) })

      expect(playerCache.size).toBe(1)
      expect(playerCache.has(`${RADIAL_FLASH_PREFIX}node-1`)).toBe(true)
      expect(playerCache.has(`${RADIAL_FLASH_PREFIX}node-2`)).toBe(false)
      expect(player2.stop).toHaveBeenCalled()
      expect(genieStateStore.getSnapshot('node-1')).toBe('busy')
      expect(genieStateStore.getSnapshot('node-2')).toBe('idle')
    })

    it('reconciles both playerCache and genieStateStore', () => {
      playerCache.set(`${RADIAL_FLASH_PREFIX}orphan`, createMockPlayer() as never)
      genieStateStore.setState('orphan', 'busy')

      const { rerender } = renderHook(({ nodeIds }) => useNodeCacheCleanup(nodeIds), {
        initialProps: { nodeIds: new Set(['orphan']) },
      })

      rerender({ nodeIds: new Set(['new-node']) })

      expect(playerCache.has(`${RADIAL_FLASH_PREFIX}orphan`)).toBe(false)
      expect(genieStateStore.getSnapshot('orphan')).toBe('idle')
    })
  })

  describe('unmount', () => {
    it('clears all caches on unmount', () => {
      const player1 = createMockPlayer()
      const player2 = createMockPlayer()
      playerCache.set(`${RADIAL_FLASH_PREFIX}node-1`, player1 as never)
      playerCache.set(`${RADIAL_FLASH_PREFIX}node-2`, player2 as never)
      genieStateStore.setState('node-1', 'busy')
      genieStateStore.setState('node-2', 'done-success')

      const { unmount } = renderHook(() => useNodeCacheCleanup(new Set(['node-1', 'node-2'])))

      expect(playerCache.size).toBe(2)

      unmount()

      expect(playerCache.size).toBe(0)
      expect(player1.stop).toHaveBeenCalled()
      expect(player2.stop).toHaveBeenCalled()
      expect(genieStateStore.getAllStates().size).toBe(0)
    })
  })

  describe('stability', () => {
    it('handles empty nodeIds set', () => {
      renderHook(() => useNodeCacheCleanup(new Set()))

      expect(playerCache.size).toBe(0)
    })

    it('handles multiple rapid nodeIds changes', () => {
      playerCache.set(`${RADIAL_FLASH_PREFIX}a`, createMockPlayer() as never)
      playerCache.set(`${RADIAL_FLASH_PREFIX}b`, createMockPlayer() as never)
      playerCache.set(`${RADIAL_FLASH_PREFIX}c`, createMockPlayer() as never)

      const { rerender } = renderHook(({ nodeIds }) => useNodeCacheCleanup(nodeIds), {
        initialProps: { nodeIds: new Set(['a', 'b', 'c']) },
      })

      rerender({ nodeIds: new Set(['a', 'b']) })
      rerender({ nodeIds: new Set(['a']) })
      rerender({ nodeIds: new Set(['a', 'd']) })

      expect(playerCache.has(`${RADIAL_FLASH_PREFIX}a`)).toBe(true)
      expect(playerCache.has(`${RADIAL_FLASH_PREFIX}b`)).toBe(false)
      expect(playerCache.has(`${RADIAL_FLASH_PREFIX}c`)).toBe(false)
    })
  })
})

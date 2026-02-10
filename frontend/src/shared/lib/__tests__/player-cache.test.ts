import { describe, it, expect, beforeEach, vi } from 'vitest'
import { playerCache, RADIAL_FLASH_PREFIX } from '../player-cache'

const createMockPlayer = () => ({
  stop: vi.fn(),
  play: vi.fn(),
  pause: vi.fn(),
  destroy: vi.fn(),
  totalFrames: 60,
  frameRate: 30,
})

describe('PlayerCache', () => {
  beforeEach(() => {
    playerCache.clear()
  })

  describe('basic operations', () => {
    it('stores and retrieves players', () => {
      const player = createMockPlayer()
      playerCache.set('player-1', player as never)

      expect(playerCache.get('player-1')).toBe(player)
      expect(playerCache.has('player-1')).toBe(true)
    })

    it('returns undefined for non-existent players', () => {
      expect(playerCache.get('non-existent')).toBeUndefined()
      expect(playerCache.has('non-existent')).toBe(false)
    })

    it('tracks size correctly', () => {
      expect(playerCache.size).toBe(0)

      playerCache.set('player-1', createMockPlayer() as never)
      expect(playerCache.size).toBe(1)

      playerCache.set('player-2', createMockPlayer() as never)
      expect(playerCache.size).toBe(2)
    })
  })

  describe('delete', () => {
    it('stops player before deleting', () => {
      const player = createMockPlayer()
      playerCache.set('player-1', player as never)

      playerCache.delete('player-1')

      expect(player.stop).toHaveBeenCalled()
      expect(playerCache.has('player-1')).toBe(false)
    })

    it('returns true when player existed', () => {
      playerCache.set('player-1', createMockPlayer() as never)
      expect(playerCache.delete('player-1')).toBe(true)
    })

    it('returns false when player did not exist', () => {
      expect(playerCache.delete('non-existent')).toBe(false)
    })
  })

  describe('clear', () => {
    it('stops all players and clears cache', () => {
      const player1 = createMockPlayer()
      const player2 = createMockPlayer()

      playerCache.set('player-1', player1 as never)
      playerCache.set('player-2', player2 as never)

      playerCache.clear()

      expect(player1.stop).toHaveBeenCalled()
      expect(player2.stop).toHaveBeenCalled()
      expect(playerCache.size).toBe(0)
    })
  })

  describe('reconcile', () => {
    it('removes orphan entries not in valid set', () => {
      const player1 = createMockPlayer()
      const player2 = createMockPlayer()
      const player3 = createMockPlayer()

      playerCache.set(`${RADIAL_FLASH_PREFIX}node-1`, player1 as never)
      playerCache.set(`${RADIAL_FLASH_PREFIX}node-2`, player2 as never)
      playerCache.set(`${RADIAL_FLASH_PREFIX}node-3`, player3 as never)

      playerCache.reconcile(new Set(['node-1', 'node-3']), RADIAL_FLASH_PREFIX)

      expect(playerCache.has(`${RADIAL_FLASH_PREFIX}node-1`)).toBe(true)
      expect(playerCache.has(`${RADIAL_FLASH_PREFIX}node-2`)).toBe(false)
      expect(playerCache.has(`${RADIAL_FLASH_PREFIX}node-3`)).toBe(true)
      expect(player2.stop).toHaveBeenCalled()
    })

    it('preserves all entries when all nodes valid', () => {
      const player1 = createMockPlayer()
      const player2 = createMockPlayer()

      playerCache.set(`${RADIAL_FLASH_PREFIX}node-1`, player1 as never)
      playerCache.set(`${RADIAL_FLASH_PREFIX}node-2`, player2 as never)

      playerCache.reconcile(new Set(['node-1', 'node-2', 'node-3']), RADIAL_FLASH_PREFIX)

      expect(playerCache.size).toBe(2)
      expect(player1.stop).not.toHaveBeenCalled()
      expect(player2.stop).not.toHaveBeenCalled()
    })

    it('ignores entries with different prefix', () => {
      const player1 = createMockPlayer()
      const player2 = createMockPlayer()

      playerCache.set(`${RADIAL_FLASH_PREFIX}node-1`, player1 as never)
      playerCache.set('other-prefix-node-2', player2 as never)

      playerCache.reconcile(new Set<string>(), RADIAL_FLASH_PREFIX)

      expect(playerCache.has(`${RADIAL_FLASH_PREFIX}node-1`)).toBe(false)
      expect(playerCache.has('other-prefix-node-2')).toBe(true)
    })

    it('is idempotent when called multiple times with same set', () => {
      const player1 = createMockPlayer()
      const player2 = createMockPlayer()

      playerCache.set(`${RADIAL_FLASH_PREFIX}node-1`, player1 as never)
      playerCache.set(`${RADIAL_FLASH_PREFIX}node-2`, player2 as never)

      const validSet = new Set(['node-1'])

      playerCache.reconcile(validSet, RADIAL_FLASH_PREFIX)
      playerCache.reconcile(validSet, RADIAL_FLASH_PREFIX)
      playerCache.reconcile(validSet, RADIAL_FLASH_PREFIX)

      expect(playerCache.size).toBe(1)
      expect(player2.stop).toHaveBeenCalledTimes(1)
    })

    it('handles empty valid set by removing all matching prefix entries', () => {
      playerCache.set(`${RADIAL_FLASH_PREFIX}node-1`, createMockPlayer() as never)
      playerCache.set(`${RADIAL_FLASH_PREFIX}node-2`, createMockPlayer() as never)

      playerCache.reconcile(new Set(), RADIAL_FLASH_PREFIX)

      expect(playerCache.size).toBe(0)
    })

    it('handles empty cache gracefully', () => {
      expect(() => {
        playerCache.reconcile(new Set(['node-1']), RADIAL_FLASH_PREFIX)
      }).not.toThrow()
      expect(playerCache.size).toBe(0)
    })
  })
})

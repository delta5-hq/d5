import type { TgsPlayerInstance } from '@shared/ui/genie/types'

type PlayerId = string

class PlayerCache {
  private cache = new Map<PlayerId, TgsPlayerInstance>()

  get(playerId: PlayerId): TgsPlayerInstance | undefined {
    return this.cache.get(playerId)
  }

  set(playerId: PlayerId, player: TgsPlayerInstance): void {
    this.cache.set(playerId, player)
  }

  has(playerId: PlayerId): boolean {
    return this.cache.has(playerId)
  }

  delete(playerId: PlayerId): boolean {
    const player = this.cache.get(playerId)
    if (player) {
      player.stop()
      this.cache.delete(playerId)
      return true
    }
    return false
  }

  clear(): void {
    this.cache.forEach(player => player.stop())
    this.cache.clear()
  }

  reconcile(validNodeIds: Set<string>, keyPrefix: string): void {
    const keysToDelete: PlayerId[] = []

    for (const playerId of this.cache.keys()) {
      if (!playerId.startsWith(keyPrefix)) continue

      const nodeId = playerId.slice(keyPrefix.length)
      if (!validNodeIds.has(nodeId)) {
        keysToDelete.push(playerId)
      }
    }

    for (const playerId of keysToDelete) {
      this.delete(playerId)
    }
  }

  get size(): number {
    return this.cache.size
  }
}

export const playerCache = new PlayerCache()

export const RADIAL_FLASH_PREFIX = 'radial-flash-'

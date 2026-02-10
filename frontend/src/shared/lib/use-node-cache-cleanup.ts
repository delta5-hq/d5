import { useEffect, useRef } from 'react'
import { playerCache, RADIAL_FLASH_PREFIX } from './player-cache'
import { genieStateStore } from './genie-state-store'

export function useNodeCacheCleanup(nodeIds: Set<string>): void {
  const isInitialMount = useRef(true)

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    playerCache.reconcile(nodeIds, RADIAL_FLASH_PREFIX)
    genieStateStore.reconcile(nodeIds)
  }, [nodeIds])

  useEffect(
    () => () => {
      playerCache.clear()
      genieStateStore.clearAll()
    },
    [],
  )
}

import { useEffect, useState } from 'react'
import type { PublicShare } from '@shared/base-types'

interface UseAutoShareOnOpenOptions {
  isDialogOpen: boolean
  autoShare: boolean
  isCurrentlyPublic: boolean
  isLoading: boolean
  userHasInteracted: boolean
  updateVisibility: (state: Partial<PublicShare>) => Promise<void>
}

interface UseAutoShareOnOpenReturn {
  hasAutoShared: boolean
}

export const useAutoShareOnOpen = ({
  isDialogOpen,
  autoShare,
  isCurrentlyPublic,
  isLoading,
  userHasInteracted,
  updateVisibility,
}: UseAutoShareOnOpenOptions): UseAutoShareOnOpenReturn => {
  const [hasAutoShared, setHasAutoShared] = useState(false)

  useEffect(() => {
    const shouldAutoShare =
      isDialogOpen && autoShare && !isCurrentlyPublic && !hasAutoShared && !isLoading && !userHasInteracted

    if (shouldAutoShare) {
      updateVisibility({ enabled: true, hidden: false })
      setHasAutoShared(true)
    }
  }, [isDialogOpen, autoShare, isCurrentlyPublic, hasAutoShared, isLoading, userHasInteracted, updateVisibility])

  useEffect(() => {
    if (!isDialogOpen) {
      setHasAutoShared(false)
    }
  }, [isDialogOpen])

  return {
    hasAutoShared,
  }
}

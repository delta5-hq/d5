import { useEffect, useState } from 'react'

interface UseUserInteractionTrackingOptions {
  isDialogOpen: boolean
}

interface UseUserInteractionTrackingReturn {
  userHasInteracted: boolean
  markUserInteraction: () => void
}

export const useUserInteractionTracking = ({
  isDialogOpen,
}: UseUserInteractionTrackingOptions): UseUserInteractionTrackingReturn => {
  const [userHasInteracted, setUserHasInteracted] = useState(false)

  useEffect(() => {
    if (!isDialogOpen) {
      setUserHasInteracted(false)
    }
  }, [isDialogOpen])

  const markUserInteraction = () => {
    setUserHasInteracted(true)
  }

  return {
    userHasInteracted,
    markUserInteraction,
  }
}

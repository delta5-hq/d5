import { useDualSidebar } from '@shared/context'
import { useSidebar } from '@shared/ui/sidebar'
import { useCallback } from 'react'

interface UseAutoCloseOnMobileReturn {
  handleMobileAutoClose: () => void
  shouldAutoClose: boolean
}

export const useAutoCloseOnMobile = (): UseAutoCloseOnMobileReturn => {
  const { isMobile } = useSidebar()
  const { setSecondaryOpen } = useDualSidebar()

  const handleMobileAutoClose = useCallback(() => {
    if (isMobile) {
      setSecondaryOpen(false)
    }
  }, [isMobile, setSecondaryOpen])

  return {
    handleMobileAutoClose,
    shouldAutoClose: isMobile,
  }
}

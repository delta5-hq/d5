import { useDualSidebar } from '@shared/context'
import { useSidebar } from '@shared/ui/sidebar'
import { MobileDismissArea } from '@shared/ui/mobile-dismiss-area'
import { type FC } from 'react'

export const MobileCloseButton: FC = () => {
  const { isMobile } = useSidebar()
  const { setSecondaryOpen } = useDualSidebar()

  if (!isMobile) {
    return null
  }

  const closeSecondary = () => {
    setSecondaryOpen(false)
  }

  return <MobileDismissArea onDismiss={closeSecondary} />
}

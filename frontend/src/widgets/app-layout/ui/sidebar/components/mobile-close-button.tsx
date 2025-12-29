import { useDualSidebar } from '@shared/context'
import { useSidebar } from '@shared/ui/sidebar'
import { Button } from '@shared/ui/button'
import { X } from 'lucide-react'
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

  return (
    <Button
      aria-label="Close menu"
      className="absolute top-2 right-2 z-10"
      onClick={closeSecondary}
      size="icon"
      variant="ghost"
    >
      <X className="h-4 w-4" />
    </Button>
  )
}

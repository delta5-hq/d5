import { useResponsive } from '@shared/composables'
import { GlassPopover, GlassPopoverContent, GlassPopoverTrigger } from '@shared/ui/glass-popover'
import { GlassSheet, GlassSheetContent, GlassSheetTrigger } from '@shared/ui/glass-sheet'
import { MobileDismissArea } from '@shared/ui/mobile-dismiss-area'
import { type ReactNode, useState } from 'react'

interface ResponsivePopoverProps {
  trigger: ReactNode
  children: (onClose: () => void) => ReactNode
  breakpoint?: number
  dataType?: string
  popoverClassName?: string
  sheetClassName?: string
  popoverSide?: 'top' | 'right' | 'bottom' | 'left'
  sheetSide?: 'top' | 'right' | 'bottom' | 'left'
}

export const useResponsivePopover = (breakpoint = 768) => {
  const [open, setOpen] = useState(false)
  const { isResponsive } = useResponsive({ breakpoint })

  const handleClose = () => setOpen(false)
  const handleOpen = () => setOpen(true)
  const handleToggle = () => setOpen(prev => !prev)

  return {
    open,
    isResponsive,
    handleClose,
    handleOpen,
    handleToggle,
    setOpen,
  }
}

export const ResponsivePopover = ({
  trigger,
  children,
  breakpoint = 768,
  dataType,
  popoverClassName = 'w-80',
  sheetClassName = 'w-full sm:max-w-md',
  popoverSide = 'right',
  sheetSide = 'left',
}: ResponsivePopoverProps) => {
  const { open, isResponsive, handleClose, setOpen } = useResponsivePopover(breakpoint)

  const content = children(handleClose)

  const mobileContent = (
    <>
      {content}
      <MobileDismissArea onDismiss={handleClose} />
    </>
  )

  if (isResponsive) {
    return (
      <GlassSheet onOpenChange={setOpen} open={open}>
        <GlassSheetTrigger asChild data-type={dataType}>
          {trigger}
        </GlassSheetTrigger>
        <GlassSheetContent className={sheetClassName} showCloseButton={false} side={sheetSide}>
          {mobileContent}
        </GlassSheetContent>
      </GlassSheet>
    )
  }

  return (
    <GlassPopover onOpenChange={setOpen} open={open}>
      <GlassPopoverTrigger asChild data-type={dataType}>
        {trigger}
      </GlassPopoverTrigger>
      <GlassPopoverContent align="end" className={popoverClassName} glassIntensity="medium" side={popoverSide}>
        {content}
      </GlassPopoverContent>
    </GlassPopover>
  )
}

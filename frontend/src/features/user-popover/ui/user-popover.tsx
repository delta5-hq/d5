import { useResponsive } from '@shared/composables'
import { GlassPopover, GlassPopoverContent, GlassPopoverTrigger } from '@shared/ui/glass-popover'
import { GlassSheet, GlassSheetContent, GlassSheetTrigger } from '@shared/ui/glass-sheet'
import { type ReactNode, useState } from 'react'
import { UserInfoBlock } from './user-info-block'
import { QuickActionsGrid } from './quick-actions-grid'
import { InlineThemeToggle } from './inline-theme-toggle'
import { MobileDismissArea } from './mobile-dismiss-area'

interface UserPopoverProps {
  trigger: ReactNode
  breakpoint?: number
  onSectionChange?: (section: string) => void
  onOpenSecondary?: () => void
}

export const UserPopover = ({ trigger, breakpoint = 768, onSectionChange, onOpenSecondary }: UserPopoverProps) => {
  const [open, setOpen] = useState(false)
  const { isResponsive } = useResponsive({ breakpoint })

  const handleClose = () => setOpen(false)

  const desktopContent = (
    <>
      <UserInfoBlock onNavigate={handleClose} />
      <QuickActionsGrid onNavigate={handleClose} onOpenSecondary={onOpenSecondary} onSectionChange={onSectionChange} />
      <InlineThemeToggle />
    </>
  )

  const mobileContent = (
    <>
      <UserInfoBlock onNavigate={handleClose} />
      <QuickActionsGrid onNavigate={handleClose} onOpenSecondary={onOpenSecondary} onSectionChange={onSectionChange} />
      <InlineThemeToggle />
      <MobileDismissArea onDismiss={handleClose} />
    </>
  )

  if (isResponsive) {
    return (
      <GlassSheet onOpenChange={setOpen} open={open}>
        <GlassSheetTrigger asChild data-type="user-settings">
          {trigger}
        </GlassSheetTrigger>
        <GlassSheetContent className="w-full sm:max-w-md" showCloseButton={false} side="left">
          {mobileContent}
        </GlassSheetContent>
      </GlassSheet>
    )
  }

  return (
    <GlassPopover onOpenChange={setOpen} open={open}>
      <GlassPopoverTrigger asChild data-type="user-settings">
        {trigger}
      </GlassPopoverTrigger>
      <GlassPopoverContent align="end" className="w-80" glassIntensity="medium" side="right">
        {desktopContent}
      </GlassPopoverContent>
    </GlassPopover>
  )
}

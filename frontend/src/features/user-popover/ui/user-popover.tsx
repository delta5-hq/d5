import { ResponsivePopover } from '@shared/ui/responsive-popover'
import { type ReactNode } from 'react'
import { UserInfoBlock } from './user-info-block'
import { QuickActionsGrid } from './quick-actions-grid'
import { InlineThemeToggle } from './inline-theme-toggle'

interface UserPopoverProps {
  trigger: ReactNode
  breakpoint?: number
  onSectionChange?: (section: string) => void
  onOpenSecondary?: () => void
}

export const UserPopover = ({ trigger, breakpoint = 768, onSectionChange, onOpenSecondary }: UserPopoverProps) => (
  <ResponsivePopover breakpoint={breakpoint} dataType="user-settings" trigger={trigger}>
    {onClose => (
      <>
        <UserInfoBlock onNavigate={onClose} />
        <QuickActionsGrid onNavigate={onClose} onOpenSecondary={onOpenSecondary} onSectionChange={onSectionChange} />
        <InlineThemeToggle />
      </>
    )}
  </ResponsivePopover>
)

import { ResponsivePopover } from '@shared/ui/responsive-popover'
import { type ReactNode } from 'react'
import { HelpMenuContent } from './help-menu-content'

interface HelpPopoverProps {
  trigger: ReactNode
  breakpoint?: number
}

export const HelpPopover = ({ trigger, breakpoint = 768 }: HelpPopoverProps) => (
  <ResponsivePopover
    breakpoint={breakpoint}
    dataType="help"
    popoverClassName="w-80"
    sheetClassName="w-full sm:max-w-md"
    showCloseButton={true}
    trigger={trigger}
  >
    {onClose => <HelpMenuContent onNavigate={onClose} />}
  </ResponsivePopover>
)

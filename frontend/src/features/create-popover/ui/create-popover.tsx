import { ResponsivePopover } from '@shared/ui/responsive-popover'
import { type ReactNode } from 'react'
import { CreateActionsContent } from './create-actions-content'

interface CreatePopoverProps {
  trigger: ReactNode
  breakpoint?: number
  onCreateWorkflow: () => void
}

export const CreatePopover = ({ trigger, breakpoint = 768, onCreateWorkflow }: CreatePopoverProps) => (
  <ResponsivePopover breakpoint={breakpoint} dataType="create-workflow" trigger={trigger}>
    {onClose => <CreateActionsContent onCreateWorkflow={onCreateWorkflow} onNavigate={onClose} />}
  </ResponsivePopover>
)

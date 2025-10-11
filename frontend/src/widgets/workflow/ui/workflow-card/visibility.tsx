import { useDialog } from '@entities/dialog'
import { Button } from '@shared/ui/button'
import type { WorkflowItem } from '@widgets/workflow/model'
import { Globe, Home, Pencil, Users } from 'lucide-react'
import React from 'react'
import { useIntl } from 'react-intl'
import WorkflowVisibilityDialog from './workflow-visibility-dialog'

interface VisibilityIconProps {
  enabled?: boolean
  hidden?: boolean
  writeable?: boolean
  className?: string
}

const VisibilityIcon: React.FC<VisibilityIconProps> = ({ enabled, hidden, writeable, className }) => {
  if (!enabled) return <Home className={className} />
  if (writeable) return <Pencil className={className} />
  if (hidden) return <Users className={className} />
  return <Globe className={className} />
}

interface VisibilityProps {
  item: WorkflowItem
  isPublic: boolean
}

export const Visibility: React.FC<VisibilityProps> = ({ item, isPublic }) => {
  const { showDialog } = useDialog()
  const { formatMessage } = useIntl()

  if (isPublic) {
    return <Globe className="h-4 w-4" />
  }

  return (
    <Button
      className="!h-4 p-0"
      onClick={() => showDialog(WorkflowVisibilityDialog, { workflowId: item.workflowId })}
      size="icon"
      title={formatMessage({ id: 'dialogWorkflowPrivacyOpenerTitle' })}
      variant="ghost"
    >
      <VisibilityIcon {...item.share?.public} className="h-4 w-4" />
    </Button>
  )
}

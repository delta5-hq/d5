import { useDialog } from '@entities/dialog'
import { Button } from '@shared/ui/button'
import type { WorkflowItem } from '@widgets/workflow/model'
import { Globe } from 'lucide-react'
import React from 'react'
import { useIntl } from 'react-intl'
import { WorkflowShareDialog } from '../share-dialog'
import { visibilityStateFromShare } from '../../model/visibility-state'
import { getVisibilityIcon } from '@shared/ui/icons/visibility-icon-mapper'
import { getVisibilityTooltipKey } from '../../lib/get-visibility-tooltip-key'

interface VisibilityProps {
  item: WorkflowItem
  isPublic: boolean
}

export const Visibility: React.FC<VisibilityProps> = ({ item, isPublic }) => {
  const { showDialog } = useDialog()
  const { formatMessage } = useIntl()
  const visibilityState = visibilityStateFromShare(item.share?.public)
  const VisibilityIcon = getVisibilityIcon(visibilityState.value)

  if (isPublic) {
    return <Globe className="h-4 w-4" />
  }

  return (
    <Button
      className="!h-4 p-0"
      onClick={() => showDialog(WorkflowShareDialog, { workflowId: item.workflowId, autoShare: false })}
      size="icon"
      title={formatMessage({ id: getVisibilityTooltipKey(visibilityState.value) })}
      variant="ghost"
    >
      <VisibilityIcon className="h-4 w-4" />
    </Button>
  )
}

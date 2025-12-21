import React from 'react'
import { Button } from '@shared/ui/button'
import { Share2 } from 'lucide-react'
import { useIntl } from 'react-intl'
import { useDialog } from '@entities/dialog'
import { WorkflowShareDialog } from '../share-dialog'
import type { WorkflowItem } from '@widgets/workflow/model'

interface ShareButtonProps {
  workflow: WorkflowItem
  variant?: 'default' | 'accent' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  showLabel?: boolean
  className?: string
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  workflow,
  variant = 'accent',
  size = 'sm',
  showLabel = true,
  className,
}) => {
  const { formatMessage } = useIntl()
  const { showDialog } = useDialog()

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation()
    showDialog(WorkflowShareDialog, { workflowId: workflow.workflowId, autoShare: true })
  }

  return (
    <Button
      className={className}
      onClick={handleShare}
      size={size}
      title={formatMessage({ id: 'shareWorkflow' })}
      variant={variant}
    >
      <Share2 className="h-4 w-4" />
      {showLabel ? <span className="ml-2">{formatMessage({ id: 'share' })}</span> : null}
    </Button>
  )
}

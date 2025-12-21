import React, { useEffect, useState } from 'react'
import {
  GlassDialog,
  GlassDialogContent,
  GlassDialogHeader,
  GlassDialogTitle,
  GlassDialogDescription,
} from '@shared/ui/glass-dialog'
import { ShareLinkSection } from './share-link-section'
import { VisibilityRadioGroup } from './visibility-radio-group'
import { Separator } from '@shared/ui/separator'
import { FormattedMessage } from 'react-intl'
import { useShareWorkflow } from '@entities/workflow/api/use-share-workflow'
import { Loader2 } from 'lucide-react'
import type { DialogProps } from '@shared/base-types'
import {
  visibilityStateFromShare,
  visibilityStateToShare,
  type VisibilityStateValue,
} from '../../model/visibility-state'

interface WorkflowShareDialogProps extends DialogProps {
  workflowId: string
  autoShare?: boolean
}

export const WorkflowShareDialog: React.FC<WorkflowShareDialogProps> = ({
  workflowId,
  open,
  onClose,
  autoShare = true,
}) => {
  const { workflow, shareUrl, isLoading, updateVisibility } = useShareWorkflow({
    workflowId,
    enabled: open,
  })

  const [hasAutoShared, setHasAutoShared] = useState(false)
  const [isPersisting, setIsPersisting] = useState(false)
  const currentVisibility = visibilityStateFromShare(workflow?.share?.public)

  useEffect(() => {
    if (open && autoShare && !currentVisibility.isPublic && !hasAutoShared && !isLoading) {
      updateVisibility({ enabled: true, hidden: false })
      setHasAutoShared(true)
    }
  }, [open, autoShare, currentVisibility.isPublic, hasAutoShared, isLoading, updateVisibility])

  useEffect(() => {
    if (!open) {
      setHasAutoShared(false)
    }
  }, [open])

  const autoCopy = !currentVisibility.isPublic && hasAutoShared

  const handleVisibilityChange = async (value: VisibilityStateValue) => {
    setIsPersisting(true)
    try {
      const newState = visibilityStateToShare(value)
      await updateVisibility(newState)
    } finally {
      setIsPersisting(false)
    }
  }

  const isInteractionDisabled = isLoading || isPersisting

  return (
    <GlassDialog onOpenChange={onClose} open={open}>
      <GlassDialogContent className="max-w-lg" glassIntensity="medium">
        <GlassDialogHeader>
          <GlassDialogTitle>
            <FormattedMessage id="shareWorkflowTitle" />
          </GlassDialogTitle>
          <GlassDialogDescription>
            <FormattedMessage id="shareWorkflowDescription" />
          </GlassDialogDescription>
        </GlassDialogHeader>

        {isLoading && !shareUrl ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {currentVisibility.isPublic ? <ShareLinkSection autoCopy={autoCopy} url={shareUrl} /> : null}

            {currentVisibility.isPublic ? <Separator /> : null}

            <div>
              <h3 className="text-sm font-medium mb-3">
                <FormattedMessage id="visibilitySettings" />
              </h3>
              <VisibilityRadioGroup
                disabled={isInteractionDisabled}
                onValueChange={handleVisibilityChange}
                value={currentVisibility.value}
              />
            </div>
          </div>
        )}
      </GlassDialogContent>
    </GlassDialog>
  )
}

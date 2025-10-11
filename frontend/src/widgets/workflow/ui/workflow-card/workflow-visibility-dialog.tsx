import { type DialogProps, type PublicShare, type WorkflowContentData } from '@shared/base-types'
import { useApiMutation, useApiQuery } from '@shared/composables'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { Separator } from '@shared/ui/separator'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Globe, Home, Pencil, Users } from 'lucide-react'
import React from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { toast } from 'sonner'

interface VisibilityDialogProps extends DialogProps {
  workflowId: string
}

const VisibilityOption: React.FC<{
  icon: React.ReactNode
  title: React.ReactNode
  description: React.ReactNode
  active: boolean
  onClick: () => void
  disabled?: boolean
}> = ({ icon, title, description, active, onClick, disabled }) => (
  <Button
    className="w-full flex items-center !justify-between text-left"
    disabled={disabled}
    onClick={onClick}
    variant="ghost"
  >
    <div className="flex items-center gap-3">
      <div className="text-green-300">{icon}</div>
      <div>
        <div className="text-green-300 font-medium">{title}</div>
        <div className="text-muted-foreground text-sm">{description}</div>
      </div>
    </div>
    {active ? <Check className="h-5 w-5 text-green-300" /> : null}
  </Button>
)

const WorkflowVisibilityDialog: React.FC<VisibilityDialogProps> = ({ workflowId, open, onClose }) => {
  const { formatMessage } = useIntl()
  const queryClient = useQueryClient()

  const { data: workflow } = useApiQuery<WorkflowContentData>({
    queryKey: ['workflow', workflowId],
    url: `/workflow/${workflowId}`,
    enabled: open,
  })

  const { mutateAsync: setMapVisibility, isPending: isLoading } = useApiMutation<
    { success: boolean },
    Error,
    Partial<PublicShare>
  >({
    url: `/workflow/${workflowId}/share/public`,
    onSuccess: async () => {
      queryClient.refetchQueries({
        queryKey: ['workflows'],
        type: 'active',
        exact: false,
      })
      onClose?.()
      toast.success(formatMessage({ id: 'shareSuccessChange' }))
    },
    onError: error => {
      toast.error(error.message)
    },
  })

  if (!workflow) return null

  const isPublic = !!workflow.share?.public?.enabled
  const isHidden = !!workflow.share?.public?.hidden
  const isWriteable = !!workflow.share?.public?.writeable

  return (
    <Dialog onOpenChange={onClose} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <FormattedMessage id="dialogWorkflowPrivacyTitle" />
          </DialogTitle>
          <DialogDescription>
            <FormattedMessage id="dialogWorkflowPrivacyMessage" />
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <VisibilityOption
            active={!isPublic}
            description={<FormattedMessage id="buttonUnshareMessage" />}
            disabled={isLoading}
            icon={<Home className="h-6 w-6" />}
            onClick={() => setMapVisibility({ enabled: false })}
            title={<FormattedMessage id="buttonUnshare" />}
          />

          <Separator />

          <VisibilityOption
            active={isPublic && !isWriteable ? isHidden : false}
            description={<FormattedMessage id="buttonShareHiddenMessage" />}
            disabled={isLoading}
            icon={<Users className="h-6 w-6" />}
            onClick={() => setMapVisibility({ enabled: true, hidden: true })}
            title={<FormattedMessage id="buttonShareHidden" />}
          />

          <Separator />

          <VisibilityOption
            active={isPublic && !isWriteable ? !isHidden : false}
            description={<FormattedMessage id="buttonShareMessage" />}
            disabled={isLoading}
            icon={<Globe className="h-6 w-6" />}
            onClick={() => setMapVisibility({ enabled: true, hidden: false })}
            title={<FormattedMessage id="buttonShare" />}
          />

          <Separator />

          <VisibilityOption
            active={isPublic && isWriteable ? isHidden : false}
            description={<FormattedMessage id="buttonShareWritableHiddenMessage" />}
            disabled={isLoading}
            icon={<Pencil className="h-6 w-6" />}
            onClick={() => setMapVisibility({ enabled: true, hidden: true, writeable: true })}
            title={<FormattedMessage id="buttonShareWritableHidden" />}
          />

          <Separator />

          {/* TODO: hide for non-admin */}
          <VisibilityOption
            active={isPublic && isWriteable ? !isHidden : false}
            description={<FormattedMessage id="buttonShareWritableMessage" />}
            disabled={isLoading}
            icon={<Pencil className="h-6 w-6" />}
            onClick={() => setMapVisibility({ enabled: true, hidden: false, writeable: true })}
            title={<FormattedMessage id="buttonShareWritable" />}
          />
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="default">
            <FormattedMessage id="cancel" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default WorkflowVisibilityDialog

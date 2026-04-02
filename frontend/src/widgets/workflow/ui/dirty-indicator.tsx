import { Loader2, Check, AlertCircle } from 'lucide-react'
import { cn } from '@shared/lib/utils'
import { FormattedMessage } from 'react-intl'

interface DirtyIndicatorProps {
  isDirty: boolean
  isSaving: boolean
  className?: string
}

export const DirtyIndicator = ({ isDirty, isSaving, className }: DirtyIndicatorProps) => {
  if (isSaving) {
    return (
      <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>
          <FormattedMessage id="workflowTree.status.saving" />
        </span>
      </div>
    )
  }

  if (isDirty) {
    return (
      <div className={cn('flex items-center gap-1.5 text-xs text-amber-600', className)}>
        <AlertCircle className="h-3 w-3" />
        <span>
          <FormattedMessage id="workflowTree.status.unsaved" />
        </span>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-1.5 text-xs text-green-600', className)}>
      <Check className="h-3 w-3" />
      <span>
        <FormattedMessage id="workflowTree.status.saved" />
      </span>
    </div>
  )
}

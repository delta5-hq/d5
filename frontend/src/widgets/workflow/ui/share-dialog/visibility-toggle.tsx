import React from 'react'
import { Switch } from '@shared/ui/switch'
import { FormattedMessage } from 'react-intl'
import { Globe, Home } from 'lucide-react'
import { cn } from '@shared/lib/utils'

interface VisibilityToggleProps {
  isPublic: boolean
  onToggle: (isPublic: boolean) => void
  isLoading?: boolean
  className?: string
}

export const VisibilityToggle: React.FC<VisibilityToggleProps> = ({
  isPublic,
  onToggle,
  isLoading = false,
  className,
}) => (
  <div className={cn('flex items-center justify-between py-3 px-1', className)}>
    <div className="flex items-center gap-2">
      {isPublic ? <Globe className="h-4 w-4 text-green-500" /> : <Home className="h-4 w-4 text-muted-foreground" />}
      <span className="text-sm font-medium">
        <FormattedMessage id="visibilityLabel" />
      </span>
    </div>

    <div className="flex items-center gap-3">
      <span className={cn('text-sm', !isPublic && 'text-muted-foreground')}>
        <FormattedMessage id="visibilityPrivate" />
      </span>
      <Switch
        aria-label="Toggle workflow visibility"
        checked={isPublic}
        disabled={isLoading}
        onCheckedChange={onToggle}
      />
      <span className={cn('text-sm', isPublic && 'text-green-500')}>
        <FormattedMessage id="visibilityPublic" />
      </span>
    </div>
  </div>
)

import React from 'react'
import { RadioGroup, RadioGroupItem } from '@shared/ui/radio-group'
import { Label } from '@shared/ui/label'
import { Switch } from '@shared/ui/switch'
import { FormattedMessage } from 'react-intl'
import { Globe, Users, Pencil } from 'lucide-react'
import { cn } from '@shared/lib/utils'
import type { VisibilityStateValue } from '../../model/visibility-state'

interface VisibilityRadioGroupProps {
  value: VisibilityStateValue
  onValueChange: (value: VisibilityStateValue) => void
  disabled?: boolean
  className?: string
}

export const VisibilityRadioGroup: React.FC<VisibilityRadioGroupProps> = ({
  value,
  onValueChange,
  disabled = false,
  className,
}) => {
  const isPrivate = value === 'private'
  const isUnlisted = value === 'unlisted' || value === 'writeable-unlisted'
  const isPublic = value === 'public' || value === 'writeable-public'

  const isUnlistedCollaborative = value === 'writeable-unlisted'
  const isPublicCollaborative = value === 'writeable-public'

  const handlePrivateClick = () => {
    onValueChange('private')
  }

  const handleUnlistedClick = () => {
    if (!isUnlisted) {
      onValueChange('unlisted')
    }
  }

  const handlePublicClick = () => {
    if (!isPublic) {
      onValueChange('public')
    }
  }

  const handleUnlistedCollaborativeToggle = (checked: boolean) => {
    onValueChange(checked ? 'writeable-unlisted' : 'unlisted')
  }

  const handlePublicCollaborativeToggle = (checked: boolean) => {
    onValueChange(checked ? 'writeable-public' : 'public')
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <RadioGroup disabled={disabled} value={value}>
        <div
          className={cn(
            'flex items-start gap-3 rounded-lg border p-3 transition-colors cursor-pointer hover:bg-accent/50',
            isPrivate && 'border-primary bg-primary/10',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
          onClick={() => !disabled && handlePrivateClick()}
        >
          <RadioGroupItem className={cn('mt-0.5', isPrivate && 'border-primary')} id="private" value="private" />
          <Label
            className={cn('flex-1 cursor-pointer font-normal', disabled && 'cursor-not-allowed')}
            htmlFor="private"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('font-medium', isPrivate && 'text-primary')}>
                <FormattedMessage id="visibilityPrivate" />
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              <FormattedMessage id="visibilityPrivateDescription" />
            </p>
          </Label>
        </div>

        <div
          className={cn(
            'flex flex-col rounded-lg border transition-colors',
            isUnlisted && 'border-blue-500 bg-blue-500/10',
          )}
        >
          <div
            className={cn(
              'flex items-start gap-3 p-3 cursor-pointer hover:bg-accent/50',
              !isUnlisted && 'rounded-lg',
              isUnlisted && 'rounded-t-lg',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
            onClick={() => !disabled && handleUnlistedClick()}
          >
            <RadioGroupItem className={cn('mt-0.5', isUnlisted && 'border-blue-500')} id="unlisted" value="unlisted" />
            <Label
              className={cn('flex-1 cursor-pointer font-normal', disabled && 'cursor-not-allowed')}
              htmlFor="unlisted"
            >
              <div className="flex items-center gap-2 mb-1">
                <Users className={cn('h-4 w-4', isUnlisted && 'text-blue-500')} />
                <span className={cn('font-medium', isUnlisted && 'text-blue-500')}>
                  <FormattedMessage id="visibilityUnlisted" />
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                <FormattedMessage id="visibilityUnlistedDescription" />
              </p>
            </Label>
          </div>

          {isUnlisted ? (
            <div className="px-3 pb-3 pt-1 border-t border-border/50">
              <div className="flex items-center justify-between gap-3 py-2 px-2 rounded-md hover:bg-accent/30 transition-colors">
                <div className="flex flex-col gap-0.5 flex-1">
                  <div className="flex items-center gap-2">
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm">
                      <FormattedMessage id="collaborativeEditing" />
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground ml-5.5">
                    <FormattedMessage id="collaborativeEditingUnlistedDescription" />
                  </p>
                </div>
                <Switch
                  checked={isUnlistedCollaborative}
                  disabled={disabled}
                  onCheckedChange={handleUnlistedCollaborativeToggle}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            'flex flex-col rounded-lg border transition-colors',
            isPublic && 'border-green-500 bg-green-500/10',
          )}
        >
          <div
            className={cn(
              'flex items-start gap-3 p-3 cursor-pointer hover:bg-accent/50',
              !isPublic && 'rounded-lg',
              isPublic && 'rounded-t-lg',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
            onClick={() => !disabled && handlePublicClick()}
          >
            <RadioGroupItem className={cn('mt-0.5', isPublic && 'border-green-500')} id="public" value="public" />
            <Label
              className={cn('flex-1 cursor-pointer font-normal', disabled && 'cursor-not-allowed')}
              htmlFor="public"
            >
              <div className="flex items-center gap-2 mb-1">
                <Globe className={cn('h-4 w-4', isPublic && 'text-green-500')} />
                <span className={cn('font-medium', isPublic && 'text-green-500')}>
                  <FormattedMessage id="visibilityPublic" />
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                <FormattedMessage id="visibilityPublicDescription" />
              </p>
            </Label>
          </div>

          {isPublic ? (
            <div className="px-3 pb-3 pt-1 border-t border-border/50">
              <div className="flex items-center justify-between gap-3 py-2 px-2 rounded-md hover:bg-accent/30 transition-colors">
                <div className="flex flex-col gap-0.5 flex-1">
                  <div className="flex items-center gap-2">
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm">
                      <FormattedMessage id="collaborativeEditing" />
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground ml-5.5">
                    <FormattedMessage id="collaborativeEditingPublicDescription" />
                  </p>
                </div>
                <Switch
                  checked={isPublicCollaborative}
                  disabled={disabled}
                  onCheckedChange={handlePublicCollaborativeToggle}
                />
              </div>
            </div>
          ) : null}
        </div>
      </RadioGroup>
    </div>
  )
}

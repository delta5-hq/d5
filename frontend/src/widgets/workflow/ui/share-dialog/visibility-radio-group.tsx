import React from 'react'
import { RadioGroup } from '@shared/ui/radio-group'
import { Globe, Users } from 'lucide-react'
import { cn } from '@shared/lib/utils'
import type { VisibilityStateValue } from '../../model/visibility-state'
import { deriveVisibilityDisplayState } from '../../model/visibility-state'
import { useVisibilityHandlers } from './use-visibility-handlers'
import { VisibilityOption } from './visibility-option'
import { CollaborativeToggle } from './collaborative-toggle'

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
  const displayState = deriveVisibilityDisplayState(value)

  const {
    handlePrivateClick,
    handleUnlistedClick,
    handlePublicClick,
    handleUnlistedCollaborativeToggle,
    handlePublicCollaborativeToggle,
  } = useVisibilityHandlers({
    currentValue: value,
    onValueChange,
    disabled,
  })

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <RadioGroup disabled={disabled} value={displayState.radioValue}>
        <VisibilityOption
          descriptionId="visibilityPrivateDescription"
          disabled={disabled}
          highlightColor="primary"
          id="private"
          isSelected={displayState.isPrivate}
          labelId="visibilityPrivate"
          onClick={handlePrivateClick}
          value="private"
        />

        <VisibilityOption
          descriptionId="visibilityUnlistedDescription"
          disabled={disabled}
          highlightColor="blue"
          icon={Users}
          id="unlisted"
          isSelected={displayState.isUnlisted}
          labelId="visibilityUnlisted"
          onClick={handleUnlistedClick}
          value="unlisted"
        >
          {displayState.isUnlisted ? (
            <CollaborativeToggle
              checked={displayState.isUnlistedCollaborative}
              descriptionId="collaborativeEditingUnlistedDescription"
              disabled={disabled}
              onCheckedChange={handleUnlistedCollaborativeToggle}
            />
          ) : null}
        </VisibilityOption>

        <VisibilityOption
          descriptionId="visibilityPublicDescription"
          disabled={disabled}
          highlightColor="green"
          icon={Globe}
          id="public"
          isSelected={displayState.isPublic}
          labelId="visibilityPublic"
          onClick={handlePublicClick}
          value="public"
        >
          {displayState.isPublic ? (
            <CollaborativeToggle
              checked={displayState.isPublicCollaborative}
              descriptionId="collaborativeEditingPublicDescription"
              disabled={disabled}
              onCheckedChange={handlePublicCollaborativeToggle}
            />
          ) : null}
        </VisibilityOption>
      </RadioGroup>
    </div>
  )
}

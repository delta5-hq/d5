import React from 'react'
import { Switch } from '@shared/ui/switch'
import { FormattedMessage } from 'react-intl'
import { Pencil } from 'lucide-react'

interface CollaborativeToggleProps {
  checked: boolean
  disabled: boolean
  onCheckedChange: (checked: boolean) => void
  descriptionId: string
}

export const CollaborativeToggle: React.FC<CollaborativeToggleProps> = ({
  checked,
  disabled,
  onCheckedChange,
  descriptionId,
}) => (
  <div className="flex items-center justify-between gap-3 py-2 px-2 rounded-md hover:bg-accent/30 transition-colors">
    <div className="flex flex-col gap-0.5 flex-1">
      <div className="flex items-center gap-2">
        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm">
          <FormattedMessage id="collaborativeEditing" />
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground ml-5.5">
        <FormattedMessage id={descriptionId} />
      </p>
    </div>
    <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
  </div>
)

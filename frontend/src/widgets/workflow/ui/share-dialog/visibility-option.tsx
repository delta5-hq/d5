import React from 'react'
import { RadioGroupItem } from '@shared/ui/radio-group'
import { Label } from '@shared/ui/label'
import { FormattedMessage } from 'react-intl'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@shared/lib/utils'

interface VisibilityOptionProps {
  id: string
  value: string
  isSelected: boolean
  disabled: boolean
  onClick: () => void
  icon?: LucideIcon
  labelId: string
  descriptionId: string
  highlightColor?: string
  children?: React.ReactNode
}

export const VisibilityOption: React.FC<VisibilityOptionProps> = ({
  id,
  value,
  isSelected,
  disabled,
  onClick,
  icon: Icon,
  labelId,
  descriptionId,
  highlightColor,
  children,
}) => {
  const borderClass = highlightColor ? `border-${highlightColor}-500 bg-${highlightColor}-500/10` : ''

  const iconColorClass = highlightColor ? `text-${highlightColor}-500` : ''

  const textColorClass = highlightColor ? `text-${highlightColor}-500` : ''

  return (
    <div className={cn('flex flex-col rounded-lg border transition-colors', isSelected && borderClass)}>
      <div
        className={cn(
          'flex items-start gap-3 p-3 cursor-pointer hover:bg-accent/50',
          !isSelected && 'rounded-lg',
          isSelected && children && 'rounded-t-lg',
          isSelected && !children && 'rounded-lg',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        onClick={onClick}
      >
        <RadioGroupItem
          className={cn('mt-0.5', isSelected && highlightColor && `border-${highlightColor}-500`)}
          id={id}
          value={value}
        />
        <Label className={cn('flex-1 cursor-pointer font-normal', disabled && 'cursor-not-allowed')} htmlFor={id}>
          <div className="flex items-center gap-2 mb-1">
            {Icon ? <Icon className={cn('h-4 w-4', isSelected && iconColorClass)} /> : null}
            <span className={cn('font-medium', isSelected && textColorClass)}>
              <FormattedMessage id={labelId} />
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            <FormattedMessage id={descriptionId} />
          </p>
        </Label>
      </div>

      {isSelected && children ? <div className="px-3 pb-3 pt-1 border-t border-border/50">{children}</div> : null}
    </div>
  )
}

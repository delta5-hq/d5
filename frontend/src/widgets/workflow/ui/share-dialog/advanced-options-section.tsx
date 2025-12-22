import React, { useState } from 'react'
import { Button } from '@shared/ui/button'
import { Separator } from '@shared/ui/separator'
import { Home, Globe, Users, Pencil, ChevronDown, ChevronUp } from 'lucide-react'
import { FormattedMessage } from 'react-intl'
import type { PublicShare } from '@shared/base-types'
import { cn } from '@shared/lib/utils'

interface VisibilityOption {
  icon: React.ReactNode
  titleId: string
  descriptionId: string
  value: Partial<PublicShare>
  adminOnly?: boolean
}

const visibilityOptions: VisibilityOption[] = [
  {
    icon: <Home className="h-5 w-5" />,
    titleId: 'buttonUnshare',
    descriptionId: 'buttonUnshareMessage',
    value: { enabled: false },
  },
  {
    icon: <Users className="h-5 w-5" />,
    titleId: 'buttonShareHidden',
    descriptionId: 'buttonShareHiddenMessage',
    value: { enabled: true, hidden: true, writeable: false },
  },
  {
    icon: <Globe className="h-5 w-5" />,
    titleId: 'buttonShare',
    descriptionId: 'buttonShareMessage',
    value: { enabled: true, hidden: false, writeable: false },
  },
  {
    icon: <Pencil className="h-5 w-5" />,
    titleId: 'buttonShareWritableHidden',
    descriptionId: 'buttonShareWritableHiddenMessage',
    value: { enabled: true, hidden: true, writeable: true },
  },
  {
    icon: <Pencil className="h-5 w-5" />,
    titleId: 'buttonShareWritable',
    descriptionId: 'buttonShareWritableMessage',
    value: { enabled: true, hidden: false, writeable: true },
    adminOnly: true,
  },
]

interface AdvancedOptionsSectionProps {
  currentState: {
    isPublic: boolean
    isHidden: boolean
    isWriteable: boolean
  }
  onChangeVisibility: (options: Partial<PublicShare>) => void
  isLoading?: boolean
  className?: string
}

export const AdvancedOptionsSection: React.FC<AdvancedOptionsSectionProps> = ({
  currentState,
  onChangeVisibility,
  isLoading = false,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const isActive = (option: VisibilityOption) => {
    const { enabled, hidden, writeable } = option.value
    if (enabled === false) return !currentState.isPublic
    if (writeable) {
      return currentState.isPublic && currentState.isWriteable && currentState.isHidden === !!hidden
    }
    return currentState.isPublic && !currentState.isWriteable && currentState.isHidden === !!hidden
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Button className="w-full justify-between" onClick={() => setIsExpanded(!isExpanded)} size="sm" variant="ghost">
        <FormattedMessage id="advancedOptions" />
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>

      {isExpanded ? (
        <div className="flex flex-col gap-2 pt-2 border-t border-card-foreground/10">
          {visibilityOptions.map((option, idx) => (
            <React.Fragment key={option.titleId}>
              <Button
                className="w-full flex items-center !justify-between text-left h-auto py-3"
                disabled={isLoading}
                onClick={() => onChangeVisibility(option.value)}
                variant="ghost"
              >
                <div className="flex items-center gap-3">
                  <div className={cn('text-muted-foreground', isActive(option) && 'text-green-500')}>{option.icon}</div>
                  <div>
                    <div className={cn('font-medium', isActive(option) && 'text-green-500')}>
                      <FormattedMessage id={option.titleId} />
                    </div>
                    <div className="text-muted-foreground text-xs">
                      <FormattedMessage id={option.descriptionId} />
                    </div>
                  </div>
                </div>
                {isActive(option) ? (
                  <div aria-label="Active" className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                ) : null}
              </Button>
              {idx < visibilityOptions.length - 1 ? <Separator /> : null}
            </React.Fragment>
          ))}
        </div>
      ) : null}
    </div>
  )
}

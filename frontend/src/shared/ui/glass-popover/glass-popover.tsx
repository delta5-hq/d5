import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '@shared/lib/utils'
import styles from './glass-popover.module.scss'

const GlassPopover = PopoverPrimitive.Root

const GlassPopoverTrigger = PopoverPrimitive.Trigger

const GlassPopoverAnchor = PopoverPrimitive.Anchor

type GlassIntensity = 'subtle' | 'medium' | 'strong'

interface GlassPopoverContentProps extends React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> {
  glassIntensity?: GlassIntensity
}

const intensityMap: Record<GlassIntensity, string> = {
  subtle: styles.glassPopoverSubtle,
  medium: styles.glassPopoverMedium,
  strong: styles.glassPopoverStrong,
}

const GlassPopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  GlassPopoverContentProps
>(({ className, align = 'center', sideOffset = 8, glassIntensity = 'medium', children, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      align={align}
      className={cn(
        intensityMap[glassIntensity],
        'relative z-50 origin-[--radix-popover-content-transform-origin]',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[side=bottom]:slide-in-from-top-2',
        'data-[side=left]:slide-in-from-right-2',
        'data-[side=right]:slide-in-from-left-2',
        'data-[side=top]:slide-in-from-bottom-2',
        'overflow-y-auto overflow-x-hidden',
        className,
      )}
      ref={ref}
      sideOffset={sideOffset}
      {...props}
    >
      {children}
    </PopoverPrimitive.Content>
  </PopoverPrimitive.Portal>
))

GlassPopoverContent.displayName = 'GlassPopoverContent'

export { GlassPopover, GlassPopoverTrigger, GlassPopoverContent, GlassPopoverAnchor }
export type { GlassIntensity }

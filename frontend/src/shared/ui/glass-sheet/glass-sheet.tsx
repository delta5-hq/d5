import * as React from 'react'
import * as SheetPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'
import { cn } from '@shared/lib/utils'
import { FormattedMessage } from 'react-intl'
import styles from './glass-sheet.module.scss'

const GlassSheet = SheetPrimitive.Root

const GlassSheetTrigger = SheetPrimitive.Trigger

const GlassSheetClose = SheetPrimitive.Close

const GlassSheetPortal = SheetPrimitive.Portal

const GlassSheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      styles.glassSheetOverlay,
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      'fixed inset-0 z-50',
      className,
    )}
    ref={ref}
    {...props}
  />
))

GlassSheetOverlay.displayName = 'GlassSheetOverlay'

type SheetSide = 'top' | 'right' | 'bottom' | 'left'

interface GlassSheetContentProps extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> {
  side?: SheetSide
  disableOverlay?: boolean
  showCloseButton?: boolean
}

const sideAnimations: Record<SheetSide, string> = {
  right:
    'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full border-l',
  left: 'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full border-r',
  top: 'data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b',
  bottom:
    'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t',
}

const GlassSheetContent = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Content>, GlassSheetContentProps>(
  ({ className, children, side = 'right', disableOverlay = false, showCloseButton = true, ...props }, ref) => (
    <GlassSheetPortal>
      {!disableOverlay ? <GlassSheetOverlay /> : null}
      <SheetPrimitive.Content
        className={cn(
          styles.glassSheet,
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'fixed z-50 flex flex-col gap-4 shadow-lg',
          'transition ease-in-out',
          'data-[state=closed]:duration-300 data-[state=open]:duration-500',
          sideAnimations[side],
          side === 'right' && 'w-full sm:max-w-md',
          side === 'left' && 'w-full sm:max-w-md',
          className,
        )}
        ref={ref}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <SheetPrimitive.Close
            className={cn(
              'ring-offset-background focus:ring-ring',
              'data-[state=open]:bg-secondary',
              'absolute top-4 right-4 rounded-xs opacity-70',
              'transition-opacity hover:opacity-100',
              'focus:ring-2 focus:ring-offset-2 focus:outline-hidden',
              'disabled:pointer-events-none',
            )}
          >
            <XIcon className="size-4" />
            <span className="sr-only">
              <FormattedMessage id="close" />
            </span>
          </SheetPrimitive.Close>
        ) : null}
      </SheetPrimitive.Content>
    </GlassSheetPortal>
  ),
)

GlassSheetContent.displayName = 'GlassSheetContent'

const GlassSheetHeader = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div className={cn('flex flex-col gap-1.5 p-4', className)} {...props} />
)

const GlassSheetFooter = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div className={cn('mt-auto flex flex-col gap-2 p-4', className)} {...props} />
)

const GlassSheetTitle = ({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) => (
  <SheetPrimitive.Title className={cn('text-foreground font-semibold', className)} {...props} />
)

const GlassSheetDescription = ({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) => (
  <SheetPrimitive.Description className={cn('text-muted-foreground text-sm', className)} {...props} />
)

export {
  GlassSheet,
  GlassSheetTrigger,
  GlassSheetClose,
  GlassSheetContent,
  GlassSheetHeader,
  GlassSheetFooter,
  GlassSheetTitle,
  GlassSheetDescription,
}

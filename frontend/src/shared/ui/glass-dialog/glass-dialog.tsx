import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@shared/lib/utils'
import { FormattedMessage } from 'react-intl'

const GlassDialog = DialogPrimitive.Root

const GlassDialogTrigger = DialogPrimitive.Trigger

const GlassDialogPortal = DialogPrimitive.Portal

const GlassDialogClose = DialogPrimitive.Close

interface GlassDialogOverlayProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> {
  blurIntensity?: 'light' | 'medium' | 'heavy'
}

const blurIntensityMap = {
  light: 'backdrop-blur-sm',
  medium: 'backdrop-blur-md',
  heavy: 'backdrop-blur-xl',
}

const GlassDialogOverlay = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Overlay>, GlassDialogOverlayProps>(
  ({ className, blurIntensity = 'medium', ...props }, ref) => (
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        blurIntensityMap[blurIntensity],
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
)
GlassDialogOverlay.displayName = 'GlassDialogOverlay'

interface GlassDialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  glassIntensity?: 'subtle' | 'medium' | 'strong'
  dismissible?: boolean
}

const glassIntensityMap = {
  subtle: 'bg-card/60 backdrop-blur-md',
  medium: 'bg-card/80 backdrop-blur-xl',
  strong: 'bg-card/95 backdrop-blur-2xl',
}

const GlassDialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, GlassDialogContentProps>(
  ({ className, children, glassIntensity = 'medium', dismissible = true, ...props }, ref) => (
    <GlassDialogPortal>
      <GlassDialogOverlay />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <DialogPrimitive.Content
          className={cn(
            'relative z-50 grid max-h-[90vh] max-w-[90vw] min-w-2xs xs:min-w-xs md:min-w-md overflow-y-auto overflow-x-hidden gap-4 border border-card-foreground/20 p-6 shadow-2xl duration-200',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=closed]:slide-out-to-top-[2%] data-[state=open]:slide-in-from-top-[2%]',
            'rounded-xl',
            glassIntensityMap[glassIntensity],
            className,
          )}
          ref={ref}
          {...props}
        >
          {children}
          {dismissible ? (
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-card transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
              <X className="h-4 w-4" />
              <span className="sr-only">
                <FormattedMessage id="close" />
              </span>
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Content>
      </div>
    </GlassDialogPortal>
  ),
)
GlassDialogContent.displayName = 'GlassDialogContent'

const GlassDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
)
GlassDialogHeader.displayName = 'GlassDialogHeader'

const GlassDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)} {...props} />
)
GlassDialogFooter.displayName = 'GlassDialogFooter'

const GlassDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    ref={ref}
    {...props}
  />
))
GlassDialogTitle.displayName = 'GlassDialogTitle'

const GlassDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description className={cn('text-sm text-muted-foreground', className)} ref={ref} {...props} />
))
GlassDialogDescription.displayName = 'GlassDialogDescription'

export {
  GlassDialog,
  GlassDialogPortal,
  GlassDialogOverlay,
  GlassDialogTrigger,
  GlassDialogClose,
  GlassDialogContent,
  GlassDialogHeader,
  GlassDialogFooter,
  GlassDialogTitle,
  GlassDialogDescription,
}

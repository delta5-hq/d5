import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { useDialogAnimation } from '@shared/lib/hooks'
import { cn } from '@shared/lib/utils'

interface GlassAuthDialogProps {
  open?: boolean
  onClose?: () => void
  title?: ReactNode
  description?: ReactNode
  hideHeader?: boolean
  children: ReactNode
}

export const GlassAuthDialog = ({ open, onClose, title, description, hideHeader, children }: GlassAuthDialogProps) => {
  const animationClasses = useDialogAnimation({ duration: 'MEDIUM', zoom: true, fadeIn: true })

  return (
    <Dialog
      onOpenChange={val => {
        if (!val) onClose?.()
      }}
      open={open}
    >
      <DialogContent
        className={cn(
          'max-w-md w-full p-8',
          'bg-card/95 backdrop-blur-xl border border-card-foreground/10',
          animationClasses,
        )}
      >
        {hideHeader ? null : (
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription />}
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  )
}

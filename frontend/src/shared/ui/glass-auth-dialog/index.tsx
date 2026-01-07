import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@shared/ui/dialog'

interface GlassAuthDialogProps {
  open?: boolean
  onClose?: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
}

export const GlassAuthDialog = ({ open, onClose, title, description, children }: GlassAuthDialogProps) => (
  <Dialog
    onOpenChange={val => {
      if (!val) onClose?.()
    }}
    open={open}
  >
    <DialogContent className="max-w-md w-full p-8 bg-card/95 backdrop-blur-xl border border-card-foreground/10">
      <DialogHeader>
        <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
        {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription />}
      </DialogHeader>
      {children}
    </DialogContent>
  </Dialog>
)

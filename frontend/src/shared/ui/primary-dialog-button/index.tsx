import type { ReactNode } from 'react'
import { Button } from '@shared/ui/button'

interface PrimaryDialogButtonProps {
  onClick: () => void
  children: ReactNode
}

export const PrimaryDialogButton = ({ onClick, children }: PrimaryDialogButtonProps) => (
  <div className="flex justify-center mt-6">
    <Button className="w-full h-12 min-h-[44px] text-base font-medium" onClick={onClick} type="button">
      {children}
    </Button>
  </div>
)

import { cn } from '@shared/lib/utils'
import { Loader } from 'lucide-react'

interface SpinnerProps {
  size?: number
  className?: string
}

export const Spinner = ({ size = 24, className = '' }: SpinnerProps) => (
  <div className={cn('flex items-center justify-center', className)}>
    <Loader className="animate-spin text-foreground" size={size} />
  </div>
)

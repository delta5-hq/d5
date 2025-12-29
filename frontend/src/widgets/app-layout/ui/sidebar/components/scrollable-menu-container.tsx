import { cn } from '@shared/lib/utils'
import { type FC, type ReactNode } from 'react'

interface ScrollableMenuContainerProps {
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export const ScrollableMenuContainer: FC<ScrollableMenuContainerProps> = ({ children, footer, className }) => (
  <div className={cn('flex flex-col h-full', className)}>
    <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
    {footer ? <div className="flex-shrink-0">{footer}</div> : null}
  </div>
)

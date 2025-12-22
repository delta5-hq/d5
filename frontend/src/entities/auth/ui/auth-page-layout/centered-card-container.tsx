import type { ReactNode } from 'react'
import { Card } from '@shared/ui/card'
import { cn } from '@shared/lib/utils'

interface CenteredCardContainerProps {
  children: ReactNode
  maxWidth?: 'sm' | 'md' | 'lg'
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
}

export const CenteredCardContainer = ({ children, maxWidth = 'md' }: CenteredCardContainerProps) => (
  <Card className={cn('w-full p-8', maxWidthClasses[maxWidth])} glassEffect>
    {children}
  </Card>
)

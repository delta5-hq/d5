import type { ReactNode } from 'react'

export interface AuthPageLayoutProps {
  children: ReactNode
  maxWidth?: 'sm' | 'md' | 'lg'
  showFooter?: boolean
}

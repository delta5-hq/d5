import type { ReactNode } from 'react'

interface SecondaryTextLinkProps {
  onClick?: () => void
  children: ReactNode
}

export const SecondaryTextLink = ({ onClick, children }: SecondaryTextLinkProps) => (
  <button
    className="text-sm text-muted-foreground hover:text-foreground hover:underline cursor-pointer transition-colors"
    onClick={onClick}
    type="button"
  >
    {children}
  </button>
)

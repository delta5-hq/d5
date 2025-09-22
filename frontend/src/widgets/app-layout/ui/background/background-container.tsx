import React from 'react'
import { useResolvedTheme } from '../../lib/use-resolved-theme'

interface BackgroundContainerProps {
  children: React.ReactNode
}

/**
 * Container component that provides theme-aware background colors
 * and manages the background styling for the main content area
 */
export const BackgroundContainer: React.FC<BackgroundContainerProps> = ({ children }) => {
  const resolvedTheme = useResolvedTheme()

  return (
    <main
      className={`relative flex-1 overflow-auto ${
        resolvedTheme === 'dark' ? 'bg-[oklch(0.145_0_0)]' : 'bg-[oklch(0.95_0.015_43.479)]'
      }`}
    >
      {children}
    </main>
  )
}

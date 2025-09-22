import React from 'react'
import { useResolvedTheme } from '../../lib/use-resolved-theme'
import { BackgroundDark } from './background-dark'
import { BackgroundLight } from './background-light'

/**
 * Unified background component that automatically switches between dark and light themes
 * based on the current resolved theme. Provides a seamless background experience
 * with responsive scaling and content height growth.
 */
export const Background: React.FC = () => {
  const resolvedTheme = useResolvedTheme()

  return resolvedTheme === 'dark' ? <BackgroundDark /> : <BackgroundLight />
}

import { useTheme } from '@shared/lib/theme-provider'
import { useEffect, useState } from 'react'

export const useThemeIcon = () => {
  const { theme } = useTheme()
  const [osTheme, setOsTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setOsTheme(mediaQuery.matches ? 'dark' : 'light')

    const handler = (e: MediaQueryListEvent) => setOsTheme(e.matches ? 'dark' : 'light')
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  const isDark = theme === 'dark' || (theme === 'system' && osTheme === 'dark')

  return { isDark, theme, osTheme }
}

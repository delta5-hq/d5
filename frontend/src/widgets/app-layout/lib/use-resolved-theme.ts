import { useEffect, useState } from 'react'
import { useTheme } from '@shared/lib/theme-provider'

export function useResolvedTheme(): 'dark' | 'light' {
  const { theme } = useTheme()
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const getResolvedTheme = () => {
      if (theme === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
      return theme as 'dark' | 'light'
    }

    const updateResolvedTheme = () => {
      setResolvedTheme(getResolvedTheme())
    }

    updateResolvedTheme()

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      mediaQuery.addEventListener('change', updateResolvedTheme)
      return () => mediaQuery.removeEventListener('change', updateResolvedTheme)
    }
  }, [theme])

  return resolvedTheme
}

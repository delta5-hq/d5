import { useState, useEffect } from 'react'

const DESKTOP_BREAKPOINT = 1440

export interface UseResponsiveOptions {
  breakpoint?: number
}

export function useResponsive(options: UseResponsiveOptions = {}) {
  const { breakpoint = DESKTOP_BREAKPOINT } = options
  const [isResponsive, setIsResponsive] = useState<boolean>(false)
  const [isDesktop, setIsDesktop] = useState<boolean>(false)
  const [isMinimized, setIsMinimized] = useState<boolean>(true)

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${breakpoint}px)`)

    const onChange = () => {
      const isDesktopView = window.innerWidth >= breakpoint
      setIsDesktop(isDesktopView)
      setIsResponsive(!isDesktopView)
    }

    mql.addEventListener('change', onChange)
    onChange()

    return () => mql.removeEventListener('change', onChange)
  }, [breakpoint])

  return {
    isResponsive,
    isDesktop,
    isMinimized,
    setIsMinimized,
  }
}

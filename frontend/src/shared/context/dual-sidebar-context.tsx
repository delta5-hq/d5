import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { safeLocalStorage } from '@shared/lib/storage'

const SECONDARY_SIDEBAR_KEY = 'secondary_sidebar_state'
const ACTIVE_SECTION_KEY = 'active_section'

interface DualSidebarContextProps {
  secondaryOpen: boolean
  setSecondaryOpen: (open: boolean) => void
  toggleSecondary: () => void
  activeSection: string | null
  setActiveSection: (section: string | null) => void
}

const DualSidebarContext = createContext<DualSidebarContextProps | null>(null)

export function useDualSidebar() {
  const context = useContext(DualSidebarContext)
  if (!context) {
    throw new Error('useDualSidebar must be used within a DualSidebarProvider.')
  }
  return context
}

interface DualSidebarProviderProps {
  children: React.ReactNode
  defaultOpen?: boolean
  defaultSection?: string | null
}

export const DualSidebarProvider: React.FC<DualSidebarProviderProps> = ({
  children,
  defaultOpen = false,
  defaultSection = null,
}) => {
  const getInitialSecondaryState = useCallback(() => {
    if (typeof window === 'undefined') return defaultOpen

    const isMobile = window.innerWidth < 768
    if (isMobile) return false

    return safeLocalStorage.getBoolean(SECONDARY_SIDEBAR_KEY) ?? defaultOpen
  }, [defaultOpen])

  const getInitialSection = useCallback(() => {
    if (typeof window === 'undefined') return defaultSection
    return safeLocalStorage.getItem(ACTIVE_SECTION_KEY) || defaultSection
  }, [defaultSection])

  const [secondaryOpen, setSecondaryOpenState] = useState(getInitialSecondaryState)
  const [activeSection, setActiveSectionState] = useState<string | null>(getInitialSection)

  const setSecondaryOpen = useCallback((open: boolean) => {
    setSecondaryOpenState(open)
    safeLocalStorage.setBoolean(SECONDARY_SIDEBAR_KEY, open)
  }, [])

  const toggleSecondary = useCallback(() => {
    setSecondaryOpen(!secondaryOpen)
  }, [secondaryOpen, setSecondaryOpen])

  const setActiveSection = useCallback((section: string | null) => {
    setActiveSectionState(section)
    if (section) {
      safeLocalStorage.setItem(ACTIVE_SECTION_KEY, section)
    } else {
      safeLocalStorage.removeItem(ACTIVE_SECTION_KEY)
    }
  }, [])

  const contextValue = useMemo<DualSidebarContextProps>(
    () => ({
      secondaryOpen,
      setSecondaryOpen,
      toggleSecondary,
      activeSection,
      setActiveSection,
    }),
    [secondaryOpen, setSecondaryOpen, toggleSecondary, activeSection, setActiveSection],
  )

  return <DualSidebarContext.Provider value={contextValue}>{children}</DualSidebarContext.Provider>
}

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { deriveActiveSectionFromRoute } from '../lib/route-to-section-mapper'

interface UseRouteBasedSectionParams {
  currentActiveSection: string | null
  onSectionChange: (section: string | null) => void
  onSecondaryOpen: () => void
  isMobile: boolean
}

export function useRouteBasedSection({
  currentActiveSection,
  onSectionChange,
  onSecondaryOpen,
  isMobile,
}: UseRouteBasedSectionParams) {
  const location = useLocation()

  useEffect(() => {
    const derivedSection = deriveActiveSectionFromRoute(location.pathname)

    if (derivedSection && derivedSection !== currentActiveSection) {
      const actualIsMobile = typeof window !== 'undefined' && window.innerWidth < 768

      onSectionChange(derivedSection)

      if (!actualIsMobile) {
        onSecondaryOpen()
      }
    }
  }, [location.pathname, currentActiveSection, onSectionChange, onSecondaryOpen, isMobile])
}

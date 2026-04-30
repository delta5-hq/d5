import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { deriveActiveSectionFromRoute } from '../lib/route-to-section-mapper'

interface UseRouteBasedSectionParams {
  currentActiveSection: string | null
  onSectionChange: (section: string | null) => void
  isMobile: boolean
}

export function useRouteBasedSection({ currentActiveSection, onSectionChange, isMobile }: UseRouteBasedSectionParams) {
  const location = useLocation()

  useEffect(() => {
    const derivedSection = deriveActiveSectionFromRoute(location.pathname)

    if (derivedSection && derivedSection !== currentActiveSection) {
      onSectionChange(derivedSection)
    }
  }, [location.pathname, currentActiveSection, onSectionChange, isMobile])
}

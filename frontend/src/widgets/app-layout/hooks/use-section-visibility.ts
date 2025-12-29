import { useAuthContext } from '@entities/auth'

interface SectionVisibility {
  showMainMenu: boolean
  showRecentItems: boolean
}

export function useSectionVisibility(activeSection?: string): SectionVisibility {
  const { isLoggedIn } = useAuthContext()

  const isHomeSection = activeSection === 'home'

  return {
    showMainMenu: !isHomeSection || isLoggedIn,
    showRecentItems: isHomeSection && isLoggedIn,
  }
}

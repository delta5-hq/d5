import type { SectionId } from '../config'

interface RouteMapping {
  readonly route: string
  readonly sectionId: SectionId
}

const ROUTE_SECTION_MAPPINGS: readonly RouteMapping[] = [
  { route: '/workflows/public', sectionId: 'public' },
  { route: '/workflows', sectionId: 'home' },
  { route: '/settings', sectionId: 'settings' },
  { route: '/admin/waitlist', sectionId: 'admin' },
  { route: '/admin/users', sectionId: 'admin' },
  { route: '/admin', sectionId: 'admin' },
] as const

export function deriveActiveSectionFromRoute(pathname: string): SectionId | null {
  const mapping = ROUTE_SECTION_MAPPINGS.find(({ route }) => pathname.startsWith(route))
  return mapping?.sectionId ?? null
}

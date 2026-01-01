export const VIEWPORTS = {
  MOBILE: { width: 375, height: 667, name: 'mobile' },
  MOBILE_LANDSCAPE: { width: 667, height: 375, name: 'mobile-landscape' },
  TABLET: { width: 768, height: 1024, name: 'tablet' },
  TABLET_LANDSCAPE: { width: 1024, height: 768, name: 'tablet-landscape' },
  DESKTOP: { width: 1280, height: 720, name: 'desktop' },
  DESKTOP_WIDE: { width: 1920, height: 1080, name: 'desktop-wide' },
} as const

export const VIEWPORT_TIERS = {
  CRITICAL: ['MOBILE', 'DESKTOP'] as const,
  RESPONSIVE: ['MOBILE', 'TABLET', 'DESKTOP'] as const,
  COMPREHENSIVE: [
    'MOBILE',
    'MOBILE_LANDSCAPE',
    'TABLET',
    'TABLET_LANDSCAPE',
    'DESKTOP',
    'DESKTOP_WIDE',
  ] as const,
}

export type ViewportKey = keyof typeof VIEWPORTS
export type ViewportTier = keyof typeof VIEWPORT_TIERS

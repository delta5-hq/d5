export const TEST_TIMEOUTS = {
  SIDEBAR_TRANSITION: 300,
  SIDEBAR_ANIMATION: 500,
  SECTION_SWITCH: 600,
  NAVIGATION: 15000,
  NETWORK_IDLE: 40000,
  RAPID_INTERACTION_DELAY: 100,
} as const

export const VIEWPORT = {
  DESKTOP: { width: 1280, height: 800 },
  MOBILE: { width: 375, height: 667 },
} as const

export const TEST_TIMEOUTS = {
  SIDEBAR_TRANSITION: 100,
  SIDEBAR_ANIMATION: 200,
  SECTION_SWITCH: 300,
  NAVIGATION: 10000,
  NETWORK_IDLE: 30000,
  RAPID_INTERACTION_DELAY: 50,
} as const

export const VIEWPORT = {
  DESKTOP: { width: 1280, height: 800 },
  MOBILE: { width: 375, height: 667 },
} as const

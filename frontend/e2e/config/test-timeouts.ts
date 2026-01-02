/* Centralized timeout constants for E2E tests */

export const TIMEOUTS = {
  UI_UPDATE: 5000,
  BACKEND_SYNC: 20000,
  SLOW_NETWORK: 40000,
  DIALOG_ANIMATION: 500,
  EXPECT_DEFAULT: 15000,
  AUTO_PUBLISH: 5000,
} as const

export type TimeoutKey = keyof typeof TIMEOUTS

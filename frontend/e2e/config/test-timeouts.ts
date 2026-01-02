/* Centralized timeout constants for E2E tests */

export const TIMEOUTS = {
  /* UI state change detection */
  UI_UPDATE: 5000,
  
  /* Backend API sync completion */
  BACKEND_SYNC: 15000,
  
  /* Slow network or heavy operations */
  SLOW_NETWORK: 30000,
  
  /* Dialog animations and transitions */
  DIALOG_ANIMATION: 500,
  
  /* Standard expect timeout */
  EXPECT_DEFAULT: 10000,
  
  /* Share button auto-publish behavior */
  AUTO_PUBLISH: 3000,
} as const

export type TimeoutKey = keyof typeof TIMEOUTS

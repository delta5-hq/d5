import { useViewportBreakpoint, MOBILE_BREAKPOINT } from './use-viewport-breakpoint'

export { MOBILE_BREAKPOINT }

export function useIsMobile(): boolean {
  return useViewportBreakpoint(MOBILE_BREAKPOINT)
}

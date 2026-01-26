import { createContext, useContext, useCallback, useRef, type ReactNode } from 'react'

interface AnimationContextValue {
  /** Check if a node should animate (was just revealed by parent expansion) */
  shouldAnimate: (nodeId: string) => boolean
  /** Mark nodes as needing animation (called when parent expands) */
  scheduleAnimation: (nodeIds: string[]) => void
  /** Clear animation flag for a node (called after animation completes) */
  clearAnimation: (nodeId: string) => void
}

const AnimationContext = createContext<AnimationContextValue | null>(null)

export function useTreeAnimation() {
  const ctx = useContext(AnimationContext)
  if (!ctx) {
    throw new Error('useTreeAnimation must be used within TreeAnimationProvider')
  }
  return ctx
}

interface TreeAnimationProviderProps {
  children: ReactNode
}

export const TreeAnimationProvider = ({ children }: TreeAnimationProviderProps) => {
  /* Use ref to avoid re-renders when animation set changes */
  const pendingAnimations = useRef(new Set<string>())

  const shouldAnimate = useCallback((nodeId: string) => pendingAnimations.current.has(nodeId), [])

  const scheduleAnimation = useCallback((nodeIds: string[]) => {
    nodeIds.forEach(id => pendingAnimations.current.add(id))
  }, [])

  const clearAnimation = useCallback((nodeId: string) => {
    pendingAnimations.current.delete(nodeId)
  }, [])

  const value: AnimationContextValue = {
    shouldAnimate,
    scheduleAnimation,
    clearAnimation,
  }

  return <AnimationContext.Provider value={value}>{children}</AnimationContext.Provider>
}

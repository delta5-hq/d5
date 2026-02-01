import { createContext, useContext, useCallback, useState, type ReactNode } from 'react'

interface AnimationContextValue {
  /** Check if a node should animate (was just revealed by parent expansion) */
  shouldAnimate: (nodeId: string) => boolean
  /** Mark nodes as needing animation (called when parent expands) */
  scheduleAnimation: (nodeIds: string[]) => void
  /** Clear animation flag for a node (called after animation completes) */
  clearAnimation: (nodeId: string) => void
  /** Animation version - increments when animations are scheduled */
  animationVersion: number
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
  /* Use state to trigger re-renders when animations are scheduled */
  const [pendingAnimations, setPendingAnimations] = useState<Set<string>>(new Set())
  const [animationVersion, setAnimationVersion] = useState(0)

  const shouldAnimate = useCallback((nodeId: string) => pendingAnimations.has(nodeId), [pendingAnimations])

  const scheduleAnimation = useCallback((nodeIds: string[]) => {
    setPendingAnimations(prev => {
      const next = new Set(prev)
      nodeIds.forEach(id => next.add(id))
      return next
    })
    setAnimationVersion(v => v + 1)
  }, [])

  const clearAnimation = useCallback((nodeId: string) => {
    setPendingAnimations(prev => {
      const next = new Set(prev)
      next.delete(nodeId)
      return next
    })
  }, [])

  const value: AnimationContextValue = {
    shouldAnimate,
    scheduleAnimation,
    clearAnimation,
    animationVersion,
  }

  return <AnimationContext.Provider value={value}>{children}</AnimationContext.Provider>
}

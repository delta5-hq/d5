import { createContext, useContext, useCallback, useRef, useMemo, type ReactNode } from 'react'

interface AnimationContextValue {
  /** Check if a node should animate (was just revealed by parent expansion) */
  shouldAnimate: (nodeId: string) => boolean
  /** Mark nodes as needing animation, with the trigger node's sparkDelay as base offset */
  scheduleAnimation: (nodeIds: string[], baseDelay: number) => void
  /** Retrieve the base sparkDelay of the trigger that scheduled this node */
  getBaseDelay: (nodeId: string) => number
  /** Clear animation flag for a node (called after animation completes) */
  clearAnimation: (nodeId: string) => void
  /** Signal that a node was just created so it flashes on first mount */
  scheduleNewNodeFlash: (nodeId: string) => void
  /** Read-once: returns true the first time, false on every subsequent call */
  consumeNewNodeFlash: (nodeId: string) => boolean
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
  /*
   * Ref-based: mutations here never trigger re-renders.
   * Newly mounted nodes read the ref on their first useEffect.
   * scheduleAnimation is called BEFORE toggleNode, so the ref is populated
   * before React renders the new children.
   * Map value = baseDelay (trigger node's sparkDelay) for relative offset.
   */
  const pendingRef = useRef<Map<string, number>>(new Map())
  const newNodeRef = useRef<Set<string>>(new Set())

  const shouldAnimate = useCallback((nodeId: string) => pendingRef.current.has(nodeId), [])

  const scheduleAnimation = useCallback((nodeIds: string[], baseDelay: number = 0) => {
    nodeIds.forEach(id => pendingRef.current.set(id, baseDelay))
  }, [])

  const getBaseDelay = useCallback((nodeId: string) => pendingRef.current.get(nodeId) ?? 0, [])

  const clearAnimation = useCallback((nodeId: string) => {
    pendingRef.current.delete(nodeId)
  }, [])

  const scheduleNewNodeFlash = useCallback((nodeId: string) => {
    newNodeRef.current.add(nodeId)
  }, [])

  const consumeNewNodeFlash = useCallback((nodeId: string): boolean => {
    if (!newNodeRef.current.has(nodeId)) return false
    newNodeRef.current.delete(nodeId)
    return true
  }, [])

  const value = useMemo(
    () => ({
      shouldAnimate,
      scheduleAnimation,
      getBaseDelay,
      clearAnimation,
      scheduleNewNodeFlash,
      consumeNewNodeFlash,
    }),
    [shouldAnimate, scheduleAnimation, getBaseDelay, clearAnimation, scheduleNewNodeFlash, consumeNewNodeFlash],
  )

  return <AnimationContext.Provider value={value}>{children}</AnimationContext.Provider>
}

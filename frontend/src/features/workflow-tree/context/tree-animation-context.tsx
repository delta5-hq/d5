import { createContext, useContext, useCallback, useRef, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import {
  shouldAnimateTree,
  getPendingTreeAnimationNodeIds,
  getTreeAnimationStartDelayMs,
  getTreeAnimationRemainingDurationMs,
  subscribeTreeAnimation,
  getTreeAnimationVersion,
  clearTreeAnimation,
} from '../core/tree-animation-store'

interface AnimationContextValue {
  /** Check if a node should animate (was just scheduled by execution fan-out) */
  shouldAnimate: (nodeId: string) => boolean
  /** Pending direct fan-out targets, used to reveal their virtualized rows before the spark starts. */
  getPendingNodeIds: () => string[]
  /** Delay remaining before this target's animation should begin */
  getStartDelay: (nodeId: string) => number
  /** Duration remaining before this target's fixed completion deadline */
  getRemainingDuration: (nodeId: string) => number
  /** Reactive registry generation; changes whenever schedules are added or cleared */
  animationVersion: number
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
   * Spark state lives in core/tree-animation-store so the non-React workflow
   * store can schedule fan-out animations through the same registry the tree
   * rows read here. New-node flash state is local: it is only written by this
   * component tree and needs no store access.
   */
  const newNodeRef = useRef<Set<string>>(new Set())
  const animationVersion = useSyncExternalStore(
    subscribeTreeAnimation,
    getTreeAnimationVersion,
    getTreeAnimationVersion,
  )

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
      shouldAnimate: shouldAnimateTree,
      getPendingNodeIds: getPendingTreeAnimationNodeIds,
      getStartDelay: getTreeAnimationStartDelayMs,
      getRemainingDuration: getTreeAnimationRemainingDurationMs,
      animationVersion,
      clearAnimation: clearTreeAnimation,
      scheduleNewNodeFlash,
      consumeNewNodeFlash,
    }),
    [animationVersion, scheduleNewNodeFlash, consumeNewNodeFlash],
  )

  return <AnimationContext.Provider value={value}>{children}</AnimationContext.Provider>
}

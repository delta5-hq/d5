/**
 * Module-level spark animation registry shared by the React tree context and the
 * non-React workflow store. The store schedules fan-out animations before it
 * commits the reveal, and the tree context reads the same registry from its
 * effects, so the pending map is populated before newly mounted rows render.
 *
 * Because each entry pins its own start and completion time, rows can mount
 * after scheduling without overrunning the result-reveal deadline.
 */
import { SPARK_DURATION_MS } from './constants'

interface PendingSpark {
  startsAt: number
  endsAt: number
}

let pendingSpark = new Map<string, PendingSpark>()
let version = 0
const listeners = new Set<() => void>()

const emitChange = (): void => {
  version += 1
  listeners.forEach(listener => listener())
}

export function scheduleTreeAnimation(
  nodeIds: string[],
  relativeDelayByNodeId: Readonly<Record<string, number>> = {},
): void {
  if (nodeIds.length === 0) return
  const scheduledAt = Date.now()
  nodeIds.forEach(id => {
    const relativeDelay = Math.max(0, relativeDelayByNodeId[id] ?? 0)
    const startsAt = scheduledAt + relativeDelay
    pendingSpark.set(id, {
      startsAt,
      endsAt: startsAt + SPARK_DURATION_MS,
    })
  })
  emitChange()
}

export function shouldAnimateTree(nodeId: string): boolean {
  return pendingSpark.has(nodeId)
}

/** Pending direct fan-out targets, in the order supplied by the execution response. */
export function getPendingTreeAnimationNodeIds(): string[] {
  return [...pendingSpark.keys()]
}

export function getTreeAnimationStartDelayMs(nodeId: string): number {
  const pending = pendingSpark.get(nodeId)
  return pending ? Math.max(0, pending.startsAt - Date.now()) : 0
}

export function getTreeAnimationRemainingDurationMs(nodeId: string): number {
  const pending = pendingSpark.get(nodeId)
  return pending ? Math.max(0, pending.endsAt - Math.max(Date.now(), pending.startsAt)) : 0
}

export function subscribeTreeAnimation(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getTreeAnimationVersion(): number {
  return version
}

export function clearTreeAnimation(nodeId: string): void {
  if (pendingSpark.delete(nodeId)) emitChange()
}

export function resetTreeAnimationState(): void {
  pendingSpark = new Map()
  emitChange()
}

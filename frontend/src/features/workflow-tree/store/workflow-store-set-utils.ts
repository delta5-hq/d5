import type { NodeId } from '@shared/base-types'

/* Referentially stable — returns same Set when nothing changed */
export function retainExistingIds(ids: Set<NodeId>, nodes: Record<NodeId, unknown>): Set<NodeId> {
  if (ids.size === 0) return ids
  const next = new Set<NodeId>()
  let dirty = false
  for (const id of ids) {
    if (id in nodes) {
      next.add(id)
    } else {
      dirty = true
    }
  }
  return dirty ? next : ids
}

/* Referentially stable — returns same Set when nothing changed */
export function excludeIds(ids: Set<NodeId>, excluded: Set<NodeId>): Set<NodeId> {
  if (ids.size === 0) return ids
  const next = new Set<NodeId>()
  let dirty = false
  for (const id of ids) {
    if (excluded.has(id)) {
      dirty = true
    } else {
      next.add(id)
    }
  }
  return dirty ? next : ids
}

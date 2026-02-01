import { useReducer, useCallback } from 'react'
import type { NodeData } from '@/shared/base-types/workflow'

export interface TreeExpansionState {
  expandedIds: Set<string>
}

export type TreeExpansionAction =
  | { type: 'TOGGLE'; id: string }
  | { type: 'EXPAND'; id: string }
  | { type: 'COLLAPSE'; id: string }
  | { type: 'EXPAND_ALL'; ids: string[] }
  | { type: 'COLLAPSE_ALL' }
  | { type: 'SET'; ids: Set<string> }

function expansionReducer(state: TreeExpansionState, action: TreeExpansionAction): TreeExpansionState {
  const newExpandedIds = new Set(state.expandedIds)

  switch (action.type) {
    case 'TOGGLE':
      if (newExpandedIds.has(action.id)) {
        newExpandedIds.delete(action.id)
      } else {
        newExpandedIds.add(action.id)
      }
      return { expandedIds: newExpandedIds }

    case 'EXPAND':
      newExpandedIds.add(action.id)
      return { expandedIds: newExpandedIds }

    case 'COLLAPSE':
      newExpandedIds.delete(action.id)
      return { expandedIds: newExpandedIds }

    case 'EXPAND_ALL':
      action.ids.forEach(id => newExpandedIds.add(id))
      return { expandedIds: newExpandedIds }

    case 'COLLAPSE_ALL':
      return { expandedIds: new Set() }

    case 'SET':
      return { expandedIds: action.ids }

    default:
      return state
  }
}

export interface UseTreeExpansionReturn {
  expandedIds: Set<string>
  toggleNode: (id: string) => void
  expandNode: (id: string) => void
  collapseNode: (id: string) => void
  expandAll: (ids: string[]) => void
  collapseAll: () => void
  setExpandedIds: (ids: Set<string>) => void
}

export function useTreeExpansion(initialExpandedIds: Set<string> = new Set()): UseTreeExpansionReturn {
  const [state, dispatch] = useReducer(expansionReducer, {
    expandedIds: initialExpandedIds,
  })

  const toggleNode = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE', id })
  }, [])

  const expandNode = useCallback((id: string) => {
    dispatch({ type: 'EXPAND', id })
  }, [])

  const collapseNode = useCallback((id: string) => {
    dispatch({ type: 'COLLAPSE', id })
  }, [])

  const expandAll = useCallback((ids: string[]) => {
    dispatch({ type: 'EXPAND_ALL', ids })
  }, [])

  const collapseAll = useCallback(() => {
    dispatch({ type: 'COLLAPSE_ALL' })
  }, [])

  const setExpandedIds = useCallback((ids: Set<string>) => {
    dispatch({ type: 'SET', ids })
  }, [])

  return {
    expandedIds: state.expandedIds,
    toggleNode,
    expandNode,
    collapseNode,
    expandAll,
    collapseAll,
    setExpandedIds,
  }
}

export function deriveExpandedIdsFromNodes(nodes: Record<string, NodeData>, rootId: string): Set<string> {
  const expandedIds = new Set<string>()

  expandedIds.add(rootId)

  for (const [nodeId, node] of Object.entries(nodes)) {
    if (node.collapsed !== true && node.children?.length) {
      expandedIds.add(nodeId)
    }
  }

  return expandedIds
}

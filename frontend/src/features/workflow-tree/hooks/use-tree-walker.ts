import { useMemo } from 'react'
import type { NodeData } from '@/shared/base-types/workflow'
import { createTreeWalker } from '../core/tree-walker'
import type { FlatTreeData, TreeWalkerGenerator } from '../core/types'

export interface UseTreeWalkerOptions {
  nodes: Record<string, NodeData>
  rootId: string
  expandedIds: Set<string>
}

export function useTreeWalker({ nodes, rootId, expandedIds }: UseTreeWalkerOptions): TreeWalkerGenerator {
  return useMemo(() => {
    const treeData: FlatTreeData = { nodes, rootId, expandedIds }
    return (refresh: boolean) => createTreeWalker(treeData, refresh)
  }, [nodes, rootId, expandedIds])
}

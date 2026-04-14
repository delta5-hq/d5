import { useCallback } from 'react'
import type { NodeData, NodeId } from '@shared/base-types'
import { extractQueryTypeFromCommand } from '@shared/lib/command-querytype-mapper'
import { hasValidCommand } from '@shared/lib/commands/command-validator'
import { useAliases } from '@entities/aliases'

export interface UseCommandEnterExecuteOptions {
  node: NodeData
  isRoot: boolean
  isExecuting: boolean
  onExecute: (node: NodeData, queryType: string) => Promise<boolean>
  onAddSibling: (nodeId: NodeId) => NodeId | null
  onSelectNode: (nodeId: NodeId) => void
}

export interface UseCommandEnterExecuteResult {
  handleCommandEnter: () => void
}

export function useCommandEnterExecute({
  node,
  isRoot,
  isExecuting,
  onExecute,
  onAddSibling,
  onSelectNode,
}: UseCommandEnterExecuteOptions): UseCommandEnterExecuteResult {
  const { aliases } = useAliases()

  const handleCommandEnter = useCallback(() => {
    if (isRoot) return
    if (isExecuting) return
    if (!hasValidCommand(node.command, aliases)) return

    const queryType = extractQueryTypeFromCommand(node.command, aliases)

    void onExecute(node, queryType)
      .then(succeeded => {
        if (!succeeded) return
        const siblingId = onAddSibling(node.id)
        if (siblingId) {
          onSelectNode(siblingId)
        }
      })
      .catch(() => {})
  }, [isRoot, isExecuting, node, onExecute, onAddSibling, onSelectNode, aliases])

  return { handleCommandEnter }
}

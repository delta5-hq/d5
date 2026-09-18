import type { NodeId } from '@shared/base-types'
import { useNodePreview } from '@features/workflow-tree/hooks/use-node-preview'
import { useWorkflowNodes, useWorkflowEdges } from '@features/workflow-tree/store'
import { cn } from '@shared/lib/utils'

interface NodePreviewSectionProps {
  nodeId: NodeId
  includeHead?: boolean
  className?: string
}

export const NodePreviewSection = ({ nodeId, includeHead, className }: NodePreviewSectionProps) => {
  const nodes = useWorkflowNodes()
  const edges = useWorkflowEdges()

  const { previewText } = useNodePreview({ nodeId, nodes, edges, includeHead })

  return (
    <pre
      className={cn(
        'mt-2 min-h-[60px] max-h-[200px] overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/50 p-2 text-xs font-mono',
        className,
      )}
      data-testid="node-preview-text"
    >
      {previewText}
    </pre>
  )
}

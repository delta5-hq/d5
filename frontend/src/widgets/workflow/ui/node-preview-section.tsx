import type { NodeId } from '@shared/base-types'
import { useNodePreview } from '@features/workflow-tree/hooks/use-node-preview'
import { useWorkflowNodes, useWorkflowEdges } from '@features/workflow-tree/store'

interface NodePreviewSectionProps {
  nodeId: NodeId
}

export const NodePreviewSection = ({ nodeId }: NodePreviewSectionProps) => {
  const nodes = useWorkflowNodes()
  const edges = useWorkflowEdges()

  const { previewText } = useNodePreview({ nodeId, nodes, edges })

  return (
    <pre
      className="mt-2 min-h-[60px] max-h-[200px] overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/50 p-2 text-xs font-mono"
      data-testid="node-preview-text"
    >
      {previewText}
    </pre>
  )
}

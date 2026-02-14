import { Loader2, Eye } from 'lucide-react'
import { FormattedMessage } from 'react-intl'
import type { NodeId } from '@shared/base-types'
import { useNodePreview } from '@features/workflow-tree/hooks/use-node-preview'
import { useWorkflowNodes, useWorkflowEdges, useWorkflowId } from '@features/workflow-tree/store'

interface NodePreviewSectionProps {
  nodeId: NodeId
  command: string | undefined
  promptTitle?: string
}

export const NodePreviewSection = ({ nodeId, command, promptTitle }: NodePreviewSectionProps) => {
  const nodes = useWorkflowNodes()
  const edges = useWorkflowEdges()
  const workflowId = useWorkflowId()

  const {
    previewText: resolvedText,
    isLoading,
    error,
  } = useNodePreview({
    nodeId,
    command,
    nodes,
    edges,
    workflowId,
  })

  const previewText = resolvedText || promptTitle || ''

  return (
    <div className="grid grid-cols-[100px_1fr] gap-2 items-start" data-testid="node-preview-section">
      <span className="text-muted-foreground text-xs pt-2 flex items-center gap-1">
        <Eye className="w-3 h-3" />
        <FormattedMessage id="workflowTree.node.preview" />
      </span>
      <div className="relative">
        {isLoading ? <Loader2 className="absolute right-2 top-2 h-3 w-3 animate-spin text-muted-foreground" /> : null}
        {error ? (
          <p className="text-xs text-destructive pt-2" data-testid="node-preview-error">
            <FormattedMessage id="workflowTree.node.previewError" />
          </p>
        ) : (
          <pre
            className="min-h-[60px] max-h-[200px] overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/50 p-2 text-xs font-mono"
            data-testid="node-preview-text"
          >
            {previewText}
          </pre>
        )}
      </div>
    </div>
  )
}

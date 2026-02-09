import { useCallback } from 'react'
import type { NodeData, NodeId } from '@shared/base-types'
import { Button } from '@shared/ui/button'
import { Genie } from '@shared/ui/genie'
import { EditableTextArea } from '@shared/ui/editable-field'
import { getCommandRole } from '@shared/constants/command-roles'
import { getColorForRole } from '@shared/ui/genie/role-colors'
import { useGenieState } from '@shared/lib/use-genie-state'
import { extractQueryTypeFromCommand } from '@shared/lib/command-querytype-mapper'
import { FileText, Folder, Loader2, Play, Copy, Trash2, Plus } from 'lucide-react'
import { FormattedMessage, useIntl } from 'react-intl'
import { normalizeNodeTitle } from '@entities/workflow/lib'
import { NodeTitleEditor } from './node-title-editor'

interface NodeDetailPanelProps {
  node: NodeData
  nodes: Record<NodeId, NodeData>
  onUpdateNode: (nodeId: NodeId, updates: Partial<Omit<NodeData, 'id' | 'parent'>>) => void
  onRequestDelete: (nodeId: NodeId) => void
  onDuplicateNode: (nodeId: NodeId) => void
  onAddChild: (parentId: NodeId) => void
  onExecute: (node: NodeData, queryType: string) => Promise<void>
  isExecuting: boolean
  autoFocusTitle?: boolean
}

export const NodeDetailPanel = ({
  node,
  nodes,
  onUpdateNode,
  onRequestDelete,
  onDuplicateNode,
  onAddChild,
  onExecute,
  isExecuting,
  autoFocusTitle,
}: NodeDetailPanelProps) => {
  const genieState = useGenieState(node.id)
  const hasChildren = Boolean(node.children?.length)
  const isRoot = !node.parent
  const { formatMessage } = useIntl()

  const handleTitleChange = useCallback(
    (title: string) => {
      onUpdateNode(node.id, { title })
    },
    [node.id, onUpdateNode],
  )

  const handleCommandChange = useCallback(
    (command: string) => {
      onUpdateNode(node.id, { command })
    },
    [node.id, onUpdateNode],
  )

  const handleExecute = useCallback(async () => {
    const queryType = extractQueryTypeFromCommand(node.command)
    await onExecute(node, queryType)
  }, [node, onExecute])

  const handleDelete = useCallback(() => {
    onRequestDelete(node.id)
  }, [node.id, onRequestDelete])

  const handleDuplicate = useCallback(() => {
    onDuplicateNode(node.id)
  }, [node.id, onDuplicateNode])

  const handleAddChild = useCallback(() => {
    onAddChild(node.id)
  }, [node.id, onAddChild])

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-start gap-4">
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <Folder className="w-4 h-4 text-amber-500 flex-shrink-0" />
            ) : (
              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            )}
            <NodeTitleEditor
              autoFocus={autoFocusTitle}
              className="flex-1 font-medium"
              onChange={handleTitleChange}
              value={normalizeNodeTitle(node.title)}
            />
          </div>

          <div className="grid grid-cols-[100px_1fr] gap-2 items-start">
            <span className="text-muted-foreground text-xs pt-2">
              <FormattedMessage id="workflowTree.node.command" />
            </span>
            <EditableTextArea
              className="min-h-[80px] text-xs font-mono w-full"
              onChange={handleCommandChange}
              placeholder={formatMessage({ id: 'workflowTree.node.commandPlaceholder' })}
              value={node.command ?? ''}
            />
          </div>

          <div className="grid grid-cols-[100px_1fr] gap-2">
            <span className="text-muted-foreground text-xs">
              <FormattedMessage id="workflowTree.node.nodeId" />
            </span>
            <span className="font-mono text-xs text-muted-foreground">{node.id}</span>
          </div>

          <div className="grid grid-cols-[100px_1fr] gap-2">
            <span className="text-muted-foreground text-xs">
              <FormattedMessage id="workflowTree.node.state" />
            </span>
            <span className="font-mono text-xs">{genieState}</span>
          </div>

          <div className="grid grid-cols-[100px_1fr] gap-2">
            <span className="text-muted-foreground text-xs">
              <FormattedMessage id="workflowTree.node.children" />
            </span>
            <span className="text-xs">{node.children?.length ?? 0}</span>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button disabled={isExecuting} onClick={handleExecute} size="sm">
              {isExecuting ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  <FormattedMessage id="workflowTree.node.executing" />
                </>
              ) : (
                <>
                  <Play className="mr-1 h-3 w-3" />
                  <FormattedMessage id="workflowTree.node.execute" />
                </>
              )}
            </Button>

            <Button onClick={handleAddChild} size="sm" variant="ghost">
              <Plus className="mr-1 h-3 w-3" />
              <FormattedMessage id="workflowTree.node.addChild" />
            </Button>

            <Button disabled={isRoot} onClick={handleDuplicate} size="sm" variant="ghost">
              <Copy className="mr-1 h-3 w-3" />
              <FormattedMessage id="workflowTree.node.duplicate" />
            </Button>

            <Button disabled={isRoot} onClick={handleDelete} size="sm" variant="danger">
              <Trash2 className="mr-1 h-3 w-3" />
              <FormattedMessage id="delete" />
            </Button>
          </div>
        </div>

        <div className="flex-shrink-0">
          <Genie
            clipboardEdge="#424242"
            clipboardFill="#ffffff"
            color={getColorForRole(getCommandRole(node.command))}
            showHandRibs={Boolean(node.command)}
            size={80}
            state={genieState}
          />
        </div>
      </div>

      {hasChildren ? (
        <div className="pt-2 border-t">
          <span className="text-muted-foreground block mb-2 text-xs">
            <FormattedMessage id="workflowTree.node.childNodes" />
          </span>
          <ul className="list-disc list-inside space-y-1">
            {node.children?.map(childId => (
              <li className="text-foreground/80 text-xs" key={childId}>
                {normalizeNodeTitle(nodes[childId]?.title) || childId}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

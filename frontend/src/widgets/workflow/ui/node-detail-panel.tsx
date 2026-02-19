import { useCallback, useEffect, useState } from 'react'
import { cn } from '@shared/lib/utils'
import type { NodeData, NodeId } from '@shared/base-types'
import { Button } from '@shared/ui/button'
import { Genie } from '@shared/ui/genie'
import { getCommandRole } from '@shared/constants/command-roles'
import { getColorForRole } from '@shared/ui/genie/role-colors'
import { useGenieState } from '@shared/lib/use-genie-state'
import { extractQueryTypeFromCommand } from '@shared/lib/command-querytype-mapper'
import { hasReferencesInAny } from '@shared/lib/reference-detection'
import { canExecuteNode } from '@shared/lib/commands/command-validator'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@shared/ui/collapsible'
import { FileText, Folder, Loader2, Play, Square, Copy, Trash2, Plus, ChevronRight, ArrowLeft } from 'lucide-react'
import { FormattedMessage, useIntl } from 'react-intl'
import { normalizeNodeTitle } from '@entities/workflow/lib'
import { NodeTitleEditor } from './node-title-editor'
import { NodePreviewSection } from './node-preview-section'
import { CommandField } from './command-field'

interface NodeDetailPanelProps {
  node: NodeData
  isPrompt: boolean
  onUpdateNode: (nodeId: NodeId, updates: Partial<Omit<NodeData, 'id' | 'parent'>>) => void
  onRequestDelete: (nodeId: NodeId) => void
  onDuplicateNode: (nodeId: NodeId) => void
  onAddChild: (parentId: NodeId) => void
  onAddSibling: (nodeId: NodeId) => NodeId | null
  onEnterInCommand: (nodeId: NodeId, committedCommand: string) => void
  onCtrlEnterInCommand: (nodeId: NodeId, committedCommand: string) => void
  onShiftCtrlEnterInCommand: (nodeId: NodeId, committedCommand: string) => void
  onClose: () => void
  onExecute: (node: NodeData, queryType: string) => Promise<boolean>
  onAbort: (nodeId: NodeId) => void
  isExecuting: boolean
  executeDisabled: boolean
  autoFocusTitle?: boolean
  autoFocusCommand?: boolean
}

export const NodeDetailPanel = ({
  node,
  isPrompt,
  onUpdateNode,
  onRequestDelete,
  onDuplicateNode,
  onAddChild,
  onAddSibling,
  onEnterInCommand,
  onCtrlEnterInCommand,
  onShiftCtrlEnterInCommand,
  onClose,
  onExecute,
  onAbort,
  isExecuting,
  executeDisabled,
  autoFocusTitle,
  autoFocusCommand,
}: NodeDetailPanelProps) => {
  const genieState = useGenieState(node.id)
  const hasChildren = Boolean(node.children?.length)
  const isRoot = !node.parent
  const mutationDisabled = isExecuting
  const { formatMessage } = useIntl()
  const showPreview = isPrompt || hasReferencesInAny(node.command, node.title)
  const canExecute = canExecuteNode(node.command, executeDisabled)
  const siblingActionsEnabled = !isRoot && canExecute

  const [settingsOpen, setSettingsOpen] = useState(!isPrompt)
  useEffect(() => {
    setSettingsOpen(!isPrompt)
  }, [isPrompt])

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

  const handleAbort = useCallback(() => {
    onAbort(node.id)
  }, [node.id, onAbort])

  const handleDelete = useCallback(() => {
    onRequestDelete(node.id)
  }, [node.id, onRequestDelete])

  const handleDuplicate = useCallback(() => {
    onDuplicateNode(node.id)
  }, [node.id, onDuplicateNode])

  const handleAddChild = useCallback(() => {
    onAddChild(node.id)
  }, [node.id, onAddChild])

  const handleAddSibling = useCallback(() => {
    onAddSibling(node.id)
  }, [node.id, onAddSibling])

  const handleEnterInCommand = useCallback(
    (committedCommand: string) => onEnterInCommand(node.id, committedCommand),
    [node.id, onEnterInCommand],
  )

  const handleCtrlEnterInCommand = useCallback(
    (committedCommand: string) => onCtrlEnterInCommand(node.id, committedCommand),
    [node.id, onCtrlEnterInCommand],
  )

  const handleShiftCtrlEnterInCommand = useCallback(
    (committedCommand: string) => onShiftCtrlEnterInCommand(node.id, committedCommand),
    [node.id, onShiftCtrlEnterInCommand],
  )

  return (
    <div className="text-sm 3xl:flex 3xl:gap-6 3xl:items-start" data-testid="node-detail-panel">
      <div className="flex-1 space-y-4">
        <button
          aria-label={formatMessage({ id: 'workflowTree.node.close' })}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors 3xl:hidden"
          data-testid="close-detail-panel-button"
          onClick={onClose}
          type="button"
        >
          <ArrowLeft className="h-3 w-3" />
          <FormattedMessage id="workflowTree.node.close" />
        </button>

        <Collapsible onOpenChange={setSettingsOpen} open={settingsOpen}>
          <CollapsibleTrigger
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors [&[data-state=open]>svg]:rotate-90"
            data-testid="settings-trigger"
          >
            <ChevronRight className="h-3 w-3 transition-transform" />
            <FormattedMessage id="workflowTree.node.settings" />
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="flex items-start gap-4 pt-2">
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
                  <CommandField
                    autoFocus={autoFocusCommand}
                    className="min-h-[80px] text-xs font-mono w-full"
                    nodeId={node.id}
                    onChange={handleCommandChange}
                    onCtrlEnter={siblingActionsEnabled ? handleCtrlEnterInCommand : undefined}
                    onEnter={handleEnterInCommand}
                    onShiftCtrlEnter={siblingActionsEnabled ? handleShiftCtrlEnterInCommand : undefined}
                    placeholder={formatMessage({ id: 'workflowTree.node.commandPlaceholder' })}
                    value={node.command ?? ''}
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button data-testid="execute-node-button" disabled={!canExecute} onClick={handleExecute} size="sm">
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

                  {isExecuting ? (
                    <Button data-testid="abort-node-button" onClick={handleAbort} size="sm" variant="danger">
                      <Square className="mr-1 h-3 w-3" />
                      <FormattedMessage id="workflowTree.node.abort" />
                    </Button>
                  ) : null}

                  <Button
                    data-testid="add-child-node-button"
                    disabled={mutationDisabled}
                    onClick={handleAddChild}
                    size="sm"
                    variant="ghost"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    <FormattedMessage id="workflowTree.node.addChild" />
                  </Button>

                  <Button
                    data-testid="add-sibling-node-button"
                    disabled={isRoot || mutationDisabled}
                    onClick={handleAddSibling}
                    size="sm"
                    variant="ghost"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    <FormattedMessage id="workflowTree.node.addSibling" />
                  </Button>

                  <Button
                    data-testid="duplicate-node-button"
                    disabled={isRoot || mutationDisabled}
                    onClick={handleDuplicate}
                    size="sm"
                    variant="ghost"
                  >
                    <Copy className="mr-1 h-3 w-3" />
                    <FormattedMessage id="workflowTree.node.duplicate" />
                  </Button>

                  <Button
                    data-testid="delete-node-button"
                    disabled={isRoot || mutationDisabled}
                    onClick={handleDelete}
                    size="sm"
                    variant="danger"
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    <FormattedMessage id="delete" />
                  </Button>
                </div>
              </div>

              <div className="flex-shrink-0" data-testid="node-genie">
                <Genie
                  clipboardEdge="#424242"
                  clipboardFill="#ffffff"
                  color={getColorForRole(getCommandRole(extractQueryTypeFromCommand(node.command)))}
                  showHandRibs={Boolean(node.command)}
                  size={80}
                  state={genieState}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className={cn('3xl:w-96 3xl:flex-shrink-0', !showPreview && 'hidden 3xl:block')}>
        <NodePreviewSection
          command={node.command}
          nodeId={node.id}
          promptTitle={isPrompt ? normalizeNodeTitle(node.title) : undefined}
          title={node.title}
        />
      </div>
    </div>
  )
}

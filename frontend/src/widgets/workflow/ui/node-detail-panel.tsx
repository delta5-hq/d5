import { useCallback, useEffect, useRef, useState } from 'react'
import type { NodeData, NodeId } from '@shared/base-types'
import { Button } from '@shared/ui/button'
import { Genie, type GenieState } from '@shared/ui/genie'
import { useGenieState } from '@shared/lib/use-genie-state'
import { extractQueryTypeFromCommand } from '@shared/lib/command-querytype-mapper'
import { canExecuteNode, isSlashCommand } from '@shared/lib/commands/command-validator'
import { useAliases } from '@entities/aliases'
import { ArrowLeft, Loader2, Pencil, Play, Square } from 'lucide-react'
import { FormattedMessage, useIntl } from 'react-intl'
import { normalizeNodeTitle } from '@entities/workflow/lib'
import { getNodeGeniePresentation } from '@features/workflow-tree/lib/node-genie-presenter'
import { isTitleDerivedFromCommand } from '@shared/lib/reliability-suffix'
import { NodeTitleEditor } from './node-title-editor'
import { NodePreviewSection } from './node-preview-section'
import { McpFusionReportPanel } from './mcp-fusion-report-panel'
import { CommandField } from './command-field'
import type { EditableTextAreaHandle } from '@shared/ui/editable-field'

interface NodeDetailPanelProps {
  node: NodeData
  onUpdateNode: (nodeId: NodeId, updates: Partial<Omit<NodeData, 'id' | 'parent'>>) => void
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

const STATUS_KEY: Record<GenieState, string> = {
  idle: 'workflowTree.status.idle',
  busy: 'workflowTree.status.busy',
  'busy-alert': 'workflowTree.status.busy',
  'done-success': 'workflowTree.status.done',
  'done-failure': 'workflowTree.status.failed',
}

export const NodeDetailPanel = ({
  node,
  onUpdateNode,
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
  const { aliases } = useAliases()
  const genieState = useGenieState(node.id)
  const isRoot = !node.parent
  const { formatMessage } = useIntl()
  const [commandDraft, setCommandDraft] = useState(node.command ?? '')
  const commandIsValid = isSlashCommand(commandDraft)
  const canExecute = canExecuteNode(commandDraft, executeDisabled)
  const siblingActionsEnabled = !isRoot && canExecute
  const titleRef = useRef<EditableTextAreaHandle>(null)

  useEffect(() => {
    setCommandDraft(node.command ?? '')
  }, [node.id, node.command])

  const handleTitleChange = useCallback(
    (title: string) => {
      onUpdateNode(node.id, { title })
    },
    [node.id, onUpdateNode],
  )

  const handleCommandChange = useCallback(
    (command: string) => {
      setCommandDraft(command)
      const titleIsDerived = !node.title || isTitleDerivedFromCommand(node.title, node.command ?? '')
      onUpdateNode(node.id, titleIsDerived ? { command, title: command } : { command })
    },
    [node, onUpdateNode],
  )

  const handleExecute = useCallback(async () => {
    const queryType = extractQueryTypeFromCommand(commandDraft, aliases)
    await onExecute({ ...node, command: commandDraft }, queryType)
  }, [node, commandDraft, onExecute, aliases])

  const handleAbort = useCallback(() => {
    onAbort(node.id)
  }, [node.id, onAbort])

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

  const autoTitle = isTitleDerivedFromCommand(node.title ?? '', node.command ?? '')
  const commandToken = commandDraft.trim().split(/\s+/)[0] ?? ''
  const commandIsSlash = commandToken.startsWith('/')
  const geniePresentation = getNodeGeniePresentation({ command: commandDraft }, { aliases })
  const genieColor = geniePresentation.color
  const firstToken = commandIsSlash ? commandToken : ''
  const statusLabel = formatMessage({ id: STATUS_KEY[genieState] })

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4" data-testid="node-detail-panel">
      <button
        aria-label={formatMessage({ id: 'workflowTree.node.close' })}
        className="flex w-fit items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground 3xl:hidden"
        data-testid="close-detail-panel-button"
        onClick={onClose}
        type="button"
      >
        <ArrowLeft className="h-3 w-3" />
        <FormattedMessage id="workflowTree.node.close" />
      </button>

      <header className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 border-b border-muted-foreground/10 pb-2">
        <Genie
          className="mt-0.5 shrink-0"
          color={genieColor}
          size={28}
          state={genieState}
          variant={geniePresentation.variant}
        />
        <div className="min-w-0 overflow-hidden" data-testid="node-detail-title-region">
          <NodeTitleEditor
            autoFocus={autoFocusTitle}
            className="w-full min-w-0 text-base font-semibold leading-6"
            editClassName="box-border max-h-24 !w-full !min-w-0 !max-w-full resize-none overflow-x-hidden overflow-y-auto rounded-lg border-primary/40 bg-background px-2 py-1 text-base font-semibold leading-6 shadow-none"
            onChange={handleTitleChange}
            readOnlyClassName="block max-w-full truncate whitespace-nowrap border-0 bg-transparent px-0 py-0 hover:border-transparent hover:bg-transparent"
            ref={titleRef}
            value={normalizeNodeTitle(node.title)}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2" data-testid="node-detail-title-actions">
          {autoTitle ? (
            <span className="shrink-0 rounded-full border border-muted-foreground/20 bg-muted px-2 py-0.5 font-mono text-xs font-bold uppercase text-muted-foreground">
              <FormattedMessage id="workflowTree.node.auto" />
            </span>
          ) : null}
          <button
            aria-label={formatMessage({ id: 'workflowTree.node.rename' })}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-muted-foreground/15 text-muted-foreground hover:border-accent/30 hover:bg-accent/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            data-testid="rename-node-button"
            onClick={() => titleRef.current?.startEditing()}
            type="button"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <section className="flex min-h-0 flex-1 flex-col overflow-y-auto" data-testid="output-section">
        <h2 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
          <FormattedMessage id="workflowTree.node.output" />
        </h2>

        <div className="flex items-start gap-3">
          <div
            className="flex shrink-0 flex-col items-center gap-1 rounded-lg border border-muted-foreground/15 bg-muted/80 p-1.5"
            data-testid="output-genie"
          >
            <Genie color={genieColor} size={40} state={genieState} variant={geniePresentation.variant} />
            <span aria-hidden="true" className="h-0.5 w-5 rounded-full" style={{ backgroundColor: genieColor }} />
          </div>

          <div
            className="min-w-0 flex-1 rounded-lg rounded-tl-sm border border-muted-foreground/15 bg-muted/70 p-2"
            data-testid="output-message"
          >
            <NodePreviewSection
              className="mt-0 min-h-[44px] max-h-[180px] border-0 bg-transparent p-0"
              includeHead={false}
              nodeId={node.id}
            />
            {node.mcpFusionReport ? (
              <div className="mt-1 border-t border-muted-foreground/10 pt-1">
                <McpFusionReportPanel report={node.mcpFusionReport} />
              </div>
            ) : null}
          </div>
        </div>

        <p className="mt-1 font-mono text-xs text-muted-foreground" data-testid="output-status-line">
          {statusLabel}
          {firstToken ? ` · ${firstToken}` : ''}
        </p>
      </section>

      <section className="shrink-0 border-t border-muted-foreground/10 pt-3" data-testid="command-section">
        <h2 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
          <FormattedMessage id="workflowTree.node.command" />
        </h2>

        <div
          className="rounded-lg border border-muted-foreground/15 bg-background p-3 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
          data-testid="command-composer"
        >
          {commandIsSlash ? (
            <span
              className="mb-2 inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-xs font-bold"
              data-testid="command-role-chip"
              style={{
                color: genieColor,
                backgroundColor: `color-mix(in oklch, ${genieColor} 12%, transparent)`,
                borderColor: `color-mix(in oklch, ${genieColor} 55%, transparent)`,
              }}
            >
              {commandToken}
            </span>
          ) : null}

          <CommandField
            autoFocus={autoFocusCommand}
            className="min-h-[180px] text-sm font-mono w-full"
            disabled={isExecuting}
            nodeId={node.id}
            onChange={handleCommandChange}
            onCtrlEnter={siblingActionsEnabled ? handleCtrlEnterInCommand : undefined}
            onDraftChange={setCommandDraft}
            onEnter={handleEnterInCommand}
            onShiftCtrlEnter={siblingActionsEnabled ? handleShiftCtrlEnterInCommand : undefined}
            placeholder={formatMessage({ id: 'workflowTree.node.commandPlaceholder' })}
            value={node.command ?? ''}
          />

          {!commandIsValid && commandDraft.trim() ? (
            <p
              className="mt-2 rounded-md border border-destructive/20 bg-destructive/5 px-2 py-1 text-xs font-medium text-destructive"
              data-testid="command-validation-message"
            >
              <FormattedMessage id="workflowTree.node.invalidCommand" />
            </p>
          ) : null}

          <footer className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-muted-foreground/10 pt-2">
            <span className="min-w-0 flex-1 truncate font-mono text-xs tabular-nums text-muted-foreground">
              {formatMessage(
                { id: 'workflowTree.node.commandFooterHint' },
                { count: commandDraft.length.toLocaleString() },
              )}
            </span>

            <div className="flex shrink-0 items-center gap-2">
              {isExecuting ? (
                <Button data-testid="abort-node-button" onClick={handleAbort} size="sm" variant="danger">
                  <Square className="mr-1 h-3 w-3" />
                  <FormattedMessage id="workflowTree.node.abort" />
                </Button>
              ) : null}

              <Button
                data-testid="execute-node-button"
                disabled={!canExecute}
                onClick={handleExecute}
                size="sm"
                variant="accent"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    <FormattedMessage id="workflowTree.node.executing" />
                  </>
                ) : (
                  <>
                    <Play className="mr-1 h-3 w-3" />
                    <FormattedMessage id="workflowTree.node.run" />
                  </>
                )}
              </Button>
            </div>
          </footer>
        </div>
      </section>
    </div>
  )
}

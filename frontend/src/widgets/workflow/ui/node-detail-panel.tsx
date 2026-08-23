import { useCallback, useEffect, useRef, useState } from 'react'
import type { NodeData, NodeId } from '@shared/base-types'
import { Button } from '@shared/ui/button'
import { Genie, type GenieState } from '@shared/ui/genie'
import { getCommandRole } from '@shared/constants/command-roles'
import { getColorForRole } from '@shared/ui/genie/role-colors'
import { useGenieState } from '@shared/lib/use-genie-state'
import { extractQueryTypeFromCommand } from '@shared/lib/command-querytype-mapper'
import { canExecuteNode, isSlashCommand } from '@shared/lib/commands/command-validator'
import { useAliases } from '@entities/aliases'
import { ArrowLeft, Loader2, Pencil, Play, Square } from 'lucide-react'
import { FormattedMessage, useIntl } from 'react-intl'
import { normalizeNodeTitle } from '@entities/workflow/lib'
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
  const genieColor = getColorForRole(getCommandRole(extractQueryTypeFromCommand(commandDraft, aliases)))
  const firstToken = commandIsSlash ? commandToken : ''
  const statusLabel = formatMessage({ id: STATUS_KEY[genieState] })

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4" data-testid="node-detail-panel">
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

      <header className="flex shrink-0 items-center gap-2 border-b border-muted-foreground/10 pb-2">
        <Genie color={genieColor} size={28} state={genieState} variant="clipboard-eyes" />
        <NodeTitleEditor
          autoFocus={autoFocusTitle}
          className="min-w-0 flex-1 text-base font-semibold leading-6"
          onChange={handleTitleChange}
          ref={titleRef}
          value={normalizeNodeTitle(node.title)}
        />
        {autoTitle ? (
          <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
            <FormattedMessage id="workflowTree.node.auto" />
          </span>
        ) : null}
        <button
          aria-label={formatMessage({ id: 'workflowTree.node.rename' })}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="rename-node-button"
          onClick={() => titleRef.current?.startEditing()}
          type="button"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </header>

      <section className="flex min-h-0 flex-1 flex-col overflow-y-auto" data-testid="output-section">
        <h2 className="mb-2 text-[11px] uppercase tracking-[0.5px] text-muted-foreground">
          <FormattedMessage id="workflowTree.node.output" />
        </h2>

        <div className="flex items-start gap-3">
          <div
            className="flex shrink-0 flex-col items-center gap-1 rounded-[11px] border bg-muted/40 p-1.5"
            data-testid="output-genie"
          >
            <Genie color={genieColor} size={40} state={genieState} variant="clipboard-eyes" />
            <span aria-hidden="true" className="h-0.5 w-5 rounded-full" style={{ backgroundColor: genieColor }} />
          </div>

          <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border bg-muted/30 p-2">
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

        <p className="mt-1 text-[11px] font-mono text-muted-foreground" data-testid="output-status-line">
          {statusLabel}
          {firstToken ? ` · ${firstToken}` : ''}
        </p>
      </section>

      <section className="shrink-0 border-t border-muted-foreground/10 pt-3" data-testid="command-section">
        <h2 className="mb-2 text-[11px] uppercase tracking-[0.5px] text-muted-foreground">
          <FormattedMessage id="workflowTree.node.command" />
        </h2>

        <div className="rounded-2xl border border-input bg-background p-3">
          {commandIsSlash ? (
            <span
              className="mb-2 inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-xs"
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

          <footer className="mt-2 flex items-center justify-between border-t border-muted-foreground/10 pt-2">
            <span className="font-mono text-xs text-muted-foreground">
              {formatMessage(
                { id: 'workflowTree.node.commandFooterHint' },
                { count: commandDraft.length.toLocaleString() },
              )}
            </span>

            <div className="flex items-center gap-2">
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

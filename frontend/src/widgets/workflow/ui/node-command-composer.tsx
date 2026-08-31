import type { NodeId } from '@shared/base-types'
import { Button } from '@shared/ui/button'
import { Loader2, Play, Square } from 'lucide-react'
import { FormattedMessage, useIntl } from 'react-intl'
import { CommandField } from './command-field'

interface NodeCommandComposerProps {
  nodeId: NodeId
  command: string
  commandDraft: string
  commandIsSlash: boolean
  commandToken: string
  commandIsValid: boolean
  genieColor: string
  isExecuting: boolean
  canExecute: boolean
  siblingActionsEnabled: boolean
  autoFocusCommand?: boolean
  onCommandChange: (command: string) => void
  onDraftChange: (draft: string) => void
  onEnter: (committedCommand: string) => void
  onCtrlEnter: (committedCommand: string) => void
  onShiftCtrlEnter: (committedCommand: string) => void
  onAbort: () => void
  onExecute: () => void
}

export const NodeCommandComposer = ({
  nodeId,
  command,
  commandDraft,
  commandIsSlash,
  commandToken,
  commandIsValid,
  genieColor,
  isExecuting,
  canExecute,
  siblingActionsEnabled,
  autoFocusCommand,
  onCommandChange,
  onDraftChange,
  onEnter,
  onCtrlEnter,
  onShiftCtrlEnter,
  onAbort,
  onExecute,
}: NodeCommandComposerProps) => {
  const { formatMessage } = useIntl()

  return (
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
          nodeId={nodeId}
          onChange={onCommandChange}
          onCtrlEnter={siblingActionsEnabled ? onCtrlEnter : undefined}
          onDraftChange={onDraftChange}
          onEnter={onEnter}
          onShiftCtrlEnter={siblingActionsEnabled ? onShiftCtrlEnter : undefined}
          placeholder={formatMessage({ id: 'workflowTree.node.commandPlaceholder' })}
          value={command}
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
              <Button data-testid="abort-node-button" onClick={onAbort} size="sm" variant="danger">
                <Square className="mr-1 h-3 w-3" />
                <FormattedMessage id="workflowTree.node.abort" />
              </Button>
            ) : null}

            <Button
              data-testid="execute-node-button"
              disabled={!canExecute}
              onClick={onExecute}
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
  )
}

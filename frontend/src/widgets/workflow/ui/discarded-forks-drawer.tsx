import type { DiscardedFork, NodeId, ReliabilityMetadata } from '@shared/base-types'
import type { ForkLeafOutput } from '@features/workflow-tree/api/streaming/fork-event-types'
import type { ForkPreviewState } from '@features/workflow-tree/store/fork-preview-state'
import {
  GlassSheet,
  GlassSheetContent,
  GlassSheetHeader,
  GlassSheetTitle,
  GlassSheetDescription,
} from '@shared/ui/glass-sheet'
import { FormattedMessage } from 'react-intl'
import { cn } from '@shared/lib/utils'

interface ForkRowProps {
  forkIndex: number
  status: string
  failedAt?: string
  reason?: string
  attempts?: number
  isPending?: boolean
  isWinner?: boolean
  leafOutputs?: ForkLeafOutput[]
}

const STATUS_CLASS: Record<string, string> = {
  ok: 'text-success',
  'criteria-failed': 'text-accent',
  'runtime-failed': 'text-destructive',
  pending: 'text-muted-foreground',
  selected: 'text-success',
}

const ForkRow = ({ forkIndex, status, failedAt, reason, attempts, isPending, isWinner, leafOutputs }: ForkRowProps) => {
  const displayStatus = isWinner ? 'selected' : isPending ? 'pending' : status
  const statusClass = STATUS_CLASS[displayStatus] ?? 'text-muted-foreground'

  return (
    <div className="flex flex-col gap-0.5 py-1.5 border-b last:border-0" data-testid={`discarded-fork-${forkIndex}`}>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-mono">
          <FormattedMessage id="workflowTree.discardedForks.forkLabel" values={{ index: forkIndex + 1 }} />
        </span>
        <span className={cn('text-xs font-medium', statusClass)}>
          {isWinner ? (
            <FormattedMessage id="workflowTree.discardedForks.status_selected" />
          ) : isPending ? (
            <FormattedMessage id="workflowTree.discardedForks.statusPending" />
          ) : (
            <FormattedMessage id={`workflowTree.discardedForks.status_${status}`} />
          )}
        </span>
        {attempts !== undefined ? (
          <span className="text-xs text-muted-foreground">
            <FormattedMessage id="workflowTree.discardedForks.attempts" values={{ count: attempts }} />
          </span>
        ) : null}
      </div>
      {failedAt ? (
        <p className="text-xs text-muted-foreground pl-2 truncate" title={failedAt}>
          <FormattedMessage id="workflowTree.discardedForks.failedAt" values={{ criterion: failedAt }} />
        </p>
      ) : null}
      {reason ? (
        <p className="text-xs text-destructive pl-2 truncate" title={reason}>
          {reason}
        </p>
      ) : null}
      {leafOutputs?.map(lo => (
        <p
          className="text-xs text-muted-foreground pl-2 mt-0.5 line-clamp-3 whitespace-pre-wrap break-words"
          data-testid={`fork-leaf-content-${forkIndex}`}
          key={lo.nodeId}
        >
          {lo.content}
        </p>
      ))}
    </div>
  )
}

interface DiscardedForksDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  nodeId: NodeId
  discardedForks?: DiscardedFork[]
  forkPreview?: ForkPreviewState
  metadata?: ReliabilityMetadata
}

const buildStoredForkRows = (metadata?: ReliabilityMetadata, discardedForks: DiscardedFork[] = []): ForkRowProps[] => {
  const winnerForkIndex = metadata?.winnerForkIndex
  const hasWinner = typeof winnerForkIndex === 'number' && winnerForkIndex >= 0
  const rowsByFork = new Map<number, ForkRowProps>()

  discardedForks.forEach(fork => rowsByFork.set(fork.forkIndex, fork))

  if (hasWinner) {
    rowsByFork.set(winnerForkIndex, {
      forkIndex: winnerForkIndex,
      status: 'ok',
      isWinner: true,
    })
  }

  return Array.from(rowsByFork.values()).sort((a, b) => a.forkIndex - b.forkIndex)
}

export const DiscardedForksDrawer = ({
  open,
  onOpenChange,
  nodeId,
  discardedForks,
  forkPreview,
  metadata,
}: DiscardedForksDrawerProps) => {
  const liveTotal = forkPreview?.total
  const liveForks = forkPreview?.forks
  const storedForkRows = buildStoredForkRows(metadata, discardedForks)

  const hasContent = Boolean((liveForks && liveForks.length > 0) || storedForkRows.length > 0)

  if (!hasContent) return null

  return (
    <GlassSheet onOpenChange={onOpenChange} open={open}>
      <GlassSheetContent data-node-id={nodeId} data-testid="discarded-forks-drawer" side="right">
        <GlassSheetHeader>
          <GlassSheetTitle>
            <FormattedMessage id="workflowTree.discardedForks.title" />
          </GlassSheetTitle>
          <GlassSheetDescription className="sr-only">
            <FormattedMessage id="workflowTree.discardedForks.title" />
          </GlassSheetDescription>
          {liveTotal ? (
            <div className="text-xs text-muted-foreground mt-1">
              <FormattedMessage id="workflowTree.discardedForks.totalLabel" values={{ total: liveTotal }} />
            </div>
          ) : null}
          {metadata ? (
            <div className="mt-2 space-y-1 text-xs text-muted-foreground" data-testid="fork-inspector-summary">
              <div>
                <FormattedMessage
                  id="workflowTree.discardedForks.selectionLabel"
                  values={{
                    eligible: metadata.eligible,
                    total: metadata.total,
                    layer: metadata.selectionLayer,
                  }}
                />
              </div>
              {metadata.failureCause ? (
                <div>
                  <FormattedMessage
                    id="workflowTree.discardedForks.failureCauseLabel"
                    values={{ cause: metadata.failureCause }}
                  />
                </div>
              ) : null}
              {metadata.judgeInput ? (
                <div>
                  <FormattedMessage
                    id="workflowTree.discardedForks.judgeInputLabel"
                    values={{
                      count: metadata.judgeInput.candidateCount,
                      budget: metadata.judgeInput.perForkBudgetChars,
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </GlassSheetHeader>

        <div className="mt-4 space-y-0 overflow-y-auto px-6 pb-6" data-testid="discarded-forks-list">
          {liveForks && liveForks.length > 0 && forkPreview?.winnerForkIndex === null
            ? liveForks.map(f => (
                <ForkRow
                  failedAt={f.failedAt}
                  forkIndex={f.forkIndex}
                  isPending={f.status === 'pending'}
                  key={f.forkIndex}
                  leafOutputs={f.leafOutputs}
                  reason={f.reason}
                  status={f.status}
                />
              ))
            : storedForkRows.map(f => (
                <ForkRow
                  attempts={f.attempts}
                  failedAt={f.failedAt}
                  forkIndex={f.forkIndex}
                  isWinner={f.isWinner}
                  key={f.forkIndex}
                  reason={f.reason}
                  status={f.status}
                />
              ))}
        </div>
      </GlassSheetContent>
    </GlassSheet>
  )
}

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { NodeData, NodeId, ReliabilityMetadata, JudgeQualityWarning } from '@shared/base-types'
import { Genie } from '@shared/ui/genie'
import { useGenieState } from '@shared/lib/use-genie-state'
import { extractQueryTypeFromCommand } from '@shared/lib/command-querytype-mapper'
import { canExecuteNode, isSlashCommand } from '@shared/lib/commands/command-validator'
import {
  isReliabilitySyntaxErrorReason,
  validateCommandForExecution,
  type ReliabilitySyntaxErrorReason,
} from '@shared/lib/command-validation'
import { useAliases } from '@entities/aliases'
import { ArrowLeft, Pencil } from 'lucide-react'
import { FormattedMessage, useIntl } from 'react-intl'
import { normalizeNodeTitle } from '@entities/workflow/lib'
import { getNodeGeniePresentation } from '@features/workflow-tree/lib/node-genie-presenter'
import {
  attachReliabilitySuffix,
  extractReliabilitySuffix,
  isTitleDerivedFromCommand,
} from '@shared/lib/reliability-suffix'
import { readCommodityN } from '@shared/lib/reliability/commodity-params'
import { NodeTitleEditor } from './node-title-editor'
import { NodeOutputSection } from './node-output-section'
import { NodeCommandComposer } from './node-command-composer'
import { CriterionVerdictDrawer } from './criterion-verdict-drawer'
import { DiscardedForksDrawer } from './discarded-forks-drawer'
import type { ForkPreviewState } from '@features/workflow-tree/store/fork-preview-state'
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
  electCost?: number | null
  electCostExceedsLimit?: boolean
  reliabilityMetadata?: ReliabilityMetadata
  forkPreview?: ForkPreviewState
  preExecuteWarnings?: JudgeQualityWarning[]
  autoFocusTitle?: boolean
  autoFocusCommand?: boolean
  openDrawerForNodeId?: string
  onDrawerOpened?: () => void
}

const RELIABILITY_SYNTAX_ERROR_I18N_KEY: Record<ReliabilitySyntaxErrorReason, string> = {
  elect_criterion_must_be_validate: 'workflowTree.node.electCriterionMustBeValidate',
  validate_retry_must_be_refine: 'workflowTree.node.validateRetryMustBeRefine',
  invalid_refine_syntax: 'workflowTree.node.invalidRefineSyntax',
  external_dispatch_refused: 'workflowTree.node.externalDispatchRefused',
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
  electCost,
  electCostExceedsLimit,
  reliabilityMetadata,
  forkPreview,
  preExecuteWarnings,
  autoFocusTitle,
  autoFocusCommand,
  openDrawerForNodeId,
  onDrawerOpened,
}: NodeDetailPanelProps) => {
  const { aliases } = useAliases()
  const genieState = useGenieState(node.id)
  const isRoot = !node.parent
  const { formatMessage } = useIntl()

  /* Draft-driven validation (workflow editor line) combined with the reliability grammar gate. */
  const [commandDraft, setCommandDraft] = useState(node.command ?? '')
  const commandIsValid = isSlashCommand(commandDraft)
  const commandValidation = validateCommandForExecution(commandDraft, false, aliases)
  const reliabilitySyntaxError = isReliabilitySyntaxErrorReason(commandValidation.reason)
    ? commandValidation.reason
    : null
  const canExecute =
    canExecuteNode(commandDraft, executeDisabled || electCostExceedsLimit === true) && !reliabilitySyntaxError
  const siblingActionsEnabled = !isRoot && canExecute
  const titleRef = useRef<EditableTextAreaHandle>(null)

  const commodityN = readCommodityN(commandDraft)
  const { baseTitle: nodeTitleBase, suffix: nodeTitleSuffix } = extractReliabilitySuffix(normalizeNodeTitle(node.title))

  const [verdictOpen, setVerdictOpen] = useState(false)
  const [forksOpen, setForksOpen] = useState(false)

  useEffect(() => {
    setCommandDraft(node.command ?? '')
  }, [node.id, node.command])

  useEffect(() => {
    if (openDrawerForNodeId !== node.id) return
    onDrawerOpened?.()
    if (!reliabilityMetadata) return
    setVerdictOpen(true)
  }, [openDrawerForNodeId, node.id, reliabilityMetadata, onDrawerOpened])

  const handleTitleChange = useCallback(
    (title: string) => {
      onUpdateNode(node.id, { title: attachReliabilitySuffix(title, nodeTitleSuffix) })
    },
    [node.id, nodeTitleSuffix, onUpdateNode],
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
    if (reliabilitySyntaxError) return
    const queryType = extractQueryTypeFromCommand(commandDraft, aliases)
    await onExecute({ ...node, command: commandDraft }, queryType)
  }, [node, commandDraft, onExecute, aliases, reliabilitySyntaxError])

  const handleAbort = useCallback(() => {
    onAbort(node.id)
  }, [node.id, onAbort])

  const handleEnterInCommand = useCallback(
    (committedCommand: string) => {
      const validation = validateCommandForExecution(committedCommand, false, aliases)
      if (isReliabilitySyntaxErrorReason(validation.reason)) return
      onEnterInCommand(node.id, committedCommand)
    },
    [node.id, onEnterInCommand, aliases],
  )

  const handleCtrlEnterInCommand = useCallback(
    (committedCommand: string) => {
      const validation = validateCommandForExecution(committedCommand, false, aliases)
      if (isReliabilitySyntaxErrorReason(validation.reason)) return
      onCtrlEnterInCommand(node.id, committedCommand)
    },
    [node.id, onCtrlEnterInCommand, aliases],
  )

  const handleShiftCtrlEnterInCommand = useCallback(
    (committedCommand: string) => onShiftCtrlEnterInCommand(node.id, committedCommand),
    [node.id, onShiftCtrlEnterInCommand],
  )

  const autoTitle = isTitleDerivedFromCommand(node.title ?? '', node.command ?? '')
  const effectiveToken = commandDraft.trim().split(/\s+/)[0] ?? ''
  const commandIsSlash = effectiveToken.startsWith('/')
  const geniePresentation = getNodeGeniePresentation({ command: commandDraft }, { aliases })
  const genieColor = geniePresentation.color

  const showForkEntry = Boolean(forkPreview) || Boolean(reliabilityMetadata)

  const commandHints: ReactNode = (
    <>
      {reliabilitySyntaxError ? (
        <span className="mt-1 block text-xs text-destructive" data-testid="command-validation-error">
          <FormattedMessage id={RELIABILITY_SYNTAX_ERROR_I18N_KEY[reliabilitySyntaxError]} />
        </span>
      ) : null}
      {typeof electCost === 'number' ? (
        <span className="mt-1 block text-xs text-muted-foreground" data-testid="elect-cost-hint">
          <FormattedMessage id="workflowTree.node.electCostHint" values={{ cost: electCost }} />
        </span>
      ) : null}
      {typeof electCost === 'number' && electCostExceedsLimit ? (
        <span className="mt-1 block text-xs text-destructive" data-testid="elect-cost-over-limit">
          <FormattedMessage id="workflowTree.node.electCostOverLimit" values={{ cost: electCost }} />
        </span>
      ) : null}
      {commodityN > 1 ? (
        <span className="mt-1 block text-xs text-accent" data-testid="commodity-ceiling-hint">
          <FormattedMessage id="workflowTree.node.commodityCeilingHint" />
        </span>
      ) : null}
      {preExecuteWarnings && preExecuteWarnings.length > 0 ? (
        <div className="mt-1 space-y-0.5" data-testid="pre-execute-warnings">
          {preExecuteWarnings.map(w => (
            <span
              className={w.severity === 'high' ? 'block text-xs text-destructive' : 'block text-xs text-accent'}
              data-testid={`pre-execute-warning-${w.condition}`}
              key={w.condition}
            >
              <FormattedMessage id={`workflowTree.verdictDrawer.judgeQualityWarning_${w.condition}`} />
            </span>
          ))}
        </div>
      ) : null}
      {reliabilityMetadata?.mode === 'suppressed' ? (
        <span className="mt-1 block text-xs text-accent" data-testid="suppressed-run-hint">
          <FormattedMessage
            id="workflowTree.node.nestedReliabilitySuppressedHint"
            values={{ n: reliabilityMetadata.requestedN ?? '' }}
          />
        </span>
      ) : null}
      {reliabilityMetadata?.perCriterionVerdict?.length ? (
        <button
          className="mt-1 block text-xs text-primary underline underline-offset-2 transition-opacity hover:opacity-80"
          data-testid="verdict-button"
          onClick={() => setVerdictOpen(true)}
          type="button"
        >
          <FormattedMessage id="workflowTree.node.verdictButton" />
        </button>
      ) : null}
      {showForkEntry ? (
        <button
          className="mt-1 block text-xs text-primary underline underline-offset-2 transition-opacity hover:opacity-80"
          data-testid="forks-button"
          onClick={() => setForksOpen(true)}
          type="button"
        >
          <FormattedMessage id="workflowTree.discardedForks.discardedForksButton" />
        </button>
      ) : null}
    </>
  )

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
            value={nodeTitleBase}
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

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <NodeOutputSection
          commandIsSlash={commandIsSlash}
          commandToken={effectiveToken}
          genieColor={genieColor}
          genieState={genieState}
          genieVariant={geniePresentation.variant}
          mcpFusionReport={node.mcpFusionReport}
          nodeId={node.id}
        />

        <NodeCommandComposer
          autoFocusCommand={autoFocusCommand}
          canExecute={canExecute}
          command={node.command ?? ''}
          commandDraft={commandDraft}
          commandIsSlash={commandIsSlash}
          commandIsValid={commandIsValid}
          commandToken={effectiveToken}
          genieColor={genieColor}
          hints={commandHints}
          isExecuting={isExecuting}
          nodeId={node.id}
          onAbort={handleAbort}
          onCommandChange={handleCommandChange}
          onCtrlEnter={handleCtrlEnterInCommand}
          onDraftChange={setCommandDraft}
          onEnter={handleEnterInCommand}
          onExecute={handleExecute}
          onShiftCtrlEnter={handleShiftCtrlEnterInCommand}
          siblingActionsEnabled={siblingActionsEnabled}
        />
      </div>

      {reliabilityMetadata ? (
        <CriterionVerdictDrawer metadata={reliabilityMetadata} onOpenChange={setVerdictOpen} open={verdictOpen} />
      ) : null}
      {showForkEntry ? (
        <DiscardedForksDrawer
          discardedForks={reliabilityMetadata?.discardedForks}
          forkPreview={forkPreview}
          metadata={reliabilityMetadata}
          nodeId={node.id}
          onOpenChange={setForksOpen}
          open={forksOpen}
        />
      ) : null}
    </div>
  )
}

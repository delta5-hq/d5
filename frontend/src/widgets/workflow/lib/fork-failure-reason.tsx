import { FormattedMessage } from 'react-intl'

const FORK_FAILURE_REASON_I18N_KEY: Record<string, string> = {
  'empty-output': 'workflowTree.discardedForks.failureReasonEmptyOutput',
  'refusal-output': 'workflowTree.discardedForks.failureReasonRefusalOutput',
  'mcp-tool-error': 'workflowTree.discardedForks.failureReasonMcpTool',
  'http-status-error': 'workflowTree.discardedForks.failureReasonHttpStatus',
  'ssh-exit-error': 'workflowTree.discardedForks.failureReasonSshExit',
  'runtime-error': 'workflowTree.discardedForks.failureReasonRuntime',
  'execution-error': 'workflowTree.discardedForks.failureReasonExecution',
  'structural-gate': 'workflowTree.discardedForks.failureReasonStructuralGate',
  'no-judge-signal': 'workflowTree.discardedForks.failureReasonNoJudgeSignal',
  'verdict-unparsed': 'workflowTree.discardedForks.failureReasonVerdictUnparsed',
}

interface ForkFailureReasonProps {
  reason: string
}

export const ForkFailureReason = ({ reason }: ForkFailureReasonProps) => {
  const i18nKey = FORK_FAILURE_REASON_I18N_KEY[reason]
  return i18nKey ? <FormattedMessage id={i18nKey} /> : reason
}

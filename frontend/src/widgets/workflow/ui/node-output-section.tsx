import type { NodeData, NodeId } from '@shared/base-types'
import { Genie, type GenieState, type GenieVariant } from '@shared/ui/genie'
import { FormattedMessage, useIntl } from 'react-intl'
import { NodePreviewSection } from './node-preview-section'
import { McpFusionReportPanel } from './mcp-fusion-report-panel'

const STATUS_KEY: Record<GenieState, string> = {
  idle: 'workflowTree.status.idle',
  busy: 'workflowTree.status.busy',
  'busy-alert': 'workflowTree.status.busy',
  'done-success': 'workflowTree.status.done',
  'done-failure': 'workflowTree.status.failed',
}

interface NodeOutputSectionProps {
  nodeId: NodeId
  genieColor: string
  genieState: GenieState
  genieVariant: GenieVariant
  mcpFusionReport: NodeData['mcpFusionReport']
  commandToken: string
  commandIsSlash: boolean
}

export const NodeOutputSection = ({
  nodeId,
  genieColor,
  genieState,
  genieVariant,
  mcpFusionReport,
  commandToken,
  commandIsSlash,
}: NodeOutputSectionProps) => {
  const { formatMessage } = useIntl()
  const statusLabel = formatMessage({ id: STATUS_KEY[genieState] })

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto" data-testid="output-section">
      <h2 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
        <FormattedMessage id="workflowTree.node.output" />
      </h2>

      <div className="flex items-start gap-3">
        <div
          className="flex shrink-0 flex-col items-center gap-1 rounded-lg border border-muted-foreground/15 bg-muted/80 p-1.5"
          data-testid="output-genie"
        >
          <Genie color={genieColor} size={40} state={genieState} variant={genieVariant} />
          <span aria-hidden="true" className="h-0.5 w-5 rounded-full" style={{ backgroundColor: genieColor }} />
        </div>

        <div
          className="relative min-w-0 flex-1 rounded-lg rounded-tl-sm border border-muted-foreground/15 bg-muted/70 p-2"
          data-testid="output-message"
        >
          {/* Chevron pointing at the Genie (mockup pointB3.svg); two layered spans so the border
              reads as an outline behind a fill. */}
          <span
            aria-hidden="true"
            className="absolute -left-[12px] top-3 h-0 w-0 border-y-[14px] border-y-transparent border-r-[12px] border-r-muted-foreground/25"
          />
          <span
            aria-hidden="true"
            className="absolute -left-[10px] top-3 h-0 w-0 border-y-[14px] border-y-transparent border-r-[12px] border-r-muted"
            data-testid="output-message-tail"
          />
          <NodePreviewSection
            className="mt-0 min-h-[44px] max-h-[180px] border-0 bg-transparent p-0"
            includeHead={false}
            nodeId={nodeId}
          />
          {mcpFusionReport ? (
            <div className="mt-1 border-t border-muted-foreground/10 pt-1">
              <McpFusionReportPanel report={mcpFusionReport} />
            </div>
          ) : null}
        </div>
      </div>

      <p className="mt-1 font-mono text-xs text-muted-foreground" data-testid="output-status-line">
        {statusLabel}
        {commandIsSlash ? ` · ${commandToken}` : ''}
      </p>
    </section>
  )
}

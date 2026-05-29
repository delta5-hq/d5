import * as React from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { MCPFusionReportData } from '@shared/base-types'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@shared/ui/collapsible'
import { FormattedMessage } from 'react-intl'

interface Props {
  report: MCPFusionReportData
}

export const McpFusionReportPanel: React.FC<Props> = ({ report }) => {
  const [open, setOpen] = React.useState(false)

  const hasContent = report.available.length > 0 || report.unavailable.length > 0 || report.toolCalls.length > 0

  if (!hasContent) return null

  return (
    <Collapsible onOpenChange={setOpen} open={open}>
      <CollapsibleTrigger className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {open ? (
          <ChevronDown aria-hidden="true" className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight aria-hidden="true" className="h-3 w-3 shrink-0" />
        )}
        <FormattedMessage id="mcp.fusionReport.title" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 space-y-2 rounded-md border bg-muted/50 p-2 text-xs font-mono">
          {report.available.length > 0 ? (
            <div>
              <p className="font-semibold text-success">
                <FormattedMessage id="mcp.fusionReport.available" />
              </p>
              {report.available.map(({ alias, toolNames }) => (
                <p className="ml-2" key={alias}>
                  {alias}: {toolNames.join(', ') || 'no tools'}
                </p>
              ))}
            </div>
          ) : null}
          {report.unavailable.length > 0 ? (
            <div>
              <p className="font-semibold text-destructive">
                <FormattedMessage id="mcp.fusionReport.unavailable" />
              </p>
              {report.unavailable.map(({ alias, phase, reason }) => (
                <p className="ml-2" key={alias}>
                  {alias}: {phase} failed — {reason}
                </p>
              ))}
            </div>
          ) : null}
          {report.toolCalls.length > 0 ? (
            <div>
              <p className="font-semibold text-muted-foreground">
                <FormattedMessage id="mcp.fusionReport.toolCalls" />
              </p>
              {report.toolCalls.map(({ alias, exposedName, toolName, status, reason }) => (
                <p className="ml-2" key={`${alias}:${exposedName}`}>
                  {alias} {exposedName} → {toolName}:{' '}
                  <span className={status === 'success' ? 'text-success' : 'text-destructive'}>{status}</span>
                  {reason ? ` — ${reason}` : ''}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

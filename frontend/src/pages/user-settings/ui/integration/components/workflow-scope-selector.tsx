import * as React from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select'
import { useUserWorkflowsList } from '@pages/user-settings/api/use-user-workflows-list'

interface WorkflowScopeSelectorProps {
  value: string | null
  onChange: (workflowId: string | null) => void
  disabled?: boolean
}

export const WorkflowScopeSelector: React.FC<WorkflowScopeSelectorProps> = ({ value, onChange, disabled }) => {
  const { workflows, isLoading } = useUserWorkflowsList()
  const intl = useIntl()

  const handleValueChange = (newValue: string) => {
    onChange(newValue === 'user-level' ? null : newValue)
  }

  const displayValue = value ?? 'user-level'

  const selectedWorkflow = value !== null ? workflows.find(w => w.workflowId === value) : undefined
  const triggerLabel =
    value === null
      ? intl.formatMessage({ id: 'integration.workflowScope.userLevel' })
      : selectedWorkflow?.title?.trim() || value

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        <FormattedMessage id="integration.workflowScope.label" />
      </label>
      <Select disabled={disabled || isLoading} onValueChange={handleValueChange} value={displayValue}>
        <SelectTrigger data-type="workflow-scope-selector">
          <SelectValue>{triggerLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem data-type="scope-user-level" value="user-level">
            <FormattedMessage id="integration.workflowScope.userLevel" />
          </SelectItem>
          {workflows.map(workflow => (
            <SelectItem
              data-type={`scope-workflow-${workflow.workflowId}`}
              key={workflow.workflowId}
              value={workflow.workflowId}
            >
              <span>{workflow.title?.trim() || workflow.workflowId}</span>
              {workflow.title?.trim() ? (
                <span className="ml-2 text-xs text-muted-foreground font-mono">{workflow.workflowId}</span>
              ) : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        <FormattedMessage
          id={
            value === null
              ? 'integration.workflowScope.descriptionUserLevel'
              : 'integration.workflowScope.descriptionWorkflow'
          }
        />
      </p>
    </div>
  )
}

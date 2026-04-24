import { useDialog } from '@entities/dialog'
import { Button } from '@shared/ui/button'
import { FormattedMessage } from 'react-intl'
import { useState } from 'react'
import IntegrationCategory from './integration-category'
import IntegrationDialog from './integration-dialog'
import { WorkflowScopeSelector } from './components/workflow-scope-selector'
import { useScopedIntegrations } from './hooks/use-scoped-integrations'
import { classifyInheritedData } from './utils/classify-inherited-data'

const IntegrationPage = () => {
  const { showDialog } = useDialog()
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null)

  const { currentScopeData, appWideScopeData, refetch } = useScopedIntegrations(selectedWorkflowId)

  const { editable, inherited } = classifyInheritedData(currentScopeData, appWideScopeData)

  const redrawPage = async () => {
    await refetch()
  }

  return (
    <div className="space-y-4 relative">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">
          <FormattedMessage id="integrationSettings.appsIntegrations" />
        </h2>

        <Button
          data-type="add-integration"
          onClick={() =>
            showDialog(IntegrationDialog, {
              data: editable,
              showDialog,
              refresh: redrawPage,
              workflowId: selectedWorkflowId,
            })
          }
          variant="accent"
        >
          <FormattedMessage id="integrationSettings.addApps" />
        </Button>
      </div>

      <div className="mb-4">
        <WorkflowScopeSelector onChange={setSelectedWorkflowId} value={selectedWorkflowId} />
      </div>

      <div className="flex justify-center">
        {editable ? (
          <IntegrationCategory
            data={editable}
            inheritedData={inherited}
            onScopeChange={setSelectedWorkflowId}
            refresh={redrawPage}
            showDialog={showDialog}
            workflowId={selectedWorkflowId}
          />
        ) : null}
      </div>
    </div>
  )
}

export default IntegrationPage

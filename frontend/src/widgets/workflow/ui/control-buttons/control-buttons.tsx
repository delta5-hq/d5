import { useIsMobile } from '@shared/composables'
import { Button } from '@shared/ui/button'
import { WorkflowShareFilters, WorkflowsView } from '@widgets/workflow/model'
import { Grid, List } from 'lucide-react'
import type React from 'react'
import { FormattedMessage } from 'react-intl'
import { FilteringTags } from './filtering-tags'

interface ControlButtonsProps {
  view: WorkflowsView
  setView: (view: WorkflowsView) => void
  shareFilter: WorkflowShareFilters
  setShareFilter: (filter: WorkflowShareFilters) => void
  isPublic: boolean
  disabled?: boolean
}

export const ControlButtons: React.FC<ControlButtonsProps> = ({
  view,
  setView,
  shareFilter,
  setShareFilter,
  isPublic,
  disabled,
}) => {
  const isMobile = useIsMobile()
  return (
    <div className="flex flex-col sm:flex-row items-center w-full p-4 gap-4">
      <h1 className="text-foreground font-bold text-2xl truncate flex-1 text-center sm:text-left">
        {isPublic ? <FormattedMessage id="homePublicText" /> : <FormattedMessage id="homePrivateText" />}
      </h1>

      {!isPublic ? (
        <div className="flex justify-center w-full sm:w-auto">
          <FilteringTags setShareFilter={setShareFilter} shareFilter={shareFilter} />
        </div>
      ) : null}

      {!isMobile ? (
        <div className="flex justify-center sm:justify-end gap-2 w-full sm:w-auto">
          <Button
            aria-label="grid"
            className="px-3 py-2"
            disabled={disabled}
            onClick={() => setView(WorkflowsView.grid)}
            variant={view === WorkflowsView.grid ? 'default' : 'outline'}
          >
            <Grid className="w-5 h-5" />
          </Button>
          <Button
            aria-label="list"
            className="px-3 py-2"
            disabled={disabled}
            onClick={() => setView(WorkflowsView.list)}
            variant={view === WorkflowsView.list ? 'default' : 'outline'}
          >
            <List className="w-5 h-5" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}

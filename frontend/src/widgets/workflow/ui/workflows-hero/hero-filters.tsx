import { Button } from '@shared/ui/button'
import { WorkflowShareFilters, WorkflowsView } from '@widgets/workflow/model'
import { Grid, List } from 'lucide-react'
import type { FC } from 'react'
import { FilteringTags } from '../control-buttons/filtering-tags'

interface HeroFiltersProps {
  isPublic: boolean
  shareFilter: WorkflowShareFilters
  onShareFilterChange: (filter: WorkflowShareFilters) => void
  view: WorkflowsView
  onViewChange: (view: WorkflowsView) => void
  disabled?: boolean
  isMobile: boolean
}

export const HeroFilters: FC<HeroFiltersProps> = ({
  isPublic,
  shareFilter,
  onShareFilterChange,
  view,
  onViewChange,
  disabled,
  isMobile,
}) => (
  <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-4">
    {!isPublic ? (
      <div className="flex justify-center w-full sm:w-auto">
        <FilteringTags setShareFilter={onShareFilterChange} shareFilter={shareFilter} />
      </div>
    ) : null}

    {!isMobile ? (
      <div className="flex justify-center sm:justify-end gap-2 w-full sm:w-auto">
        <Button
          aria-label="grid"
          className="px-3 py-2"
          disabled={disabled}
          onClick={() => onViewChange(WorkflowsView.grid)}
          variant={view === WorkflowsView.grid ? 'default' : 'ghost'}
        >
          <Grid className="w-5 h-5" />
        </Button>
        <Button
          aria-label="list"
          className="px-3 py-2"
          disabled={disabled}
          onClick={() => onViewChange(WorkflowsView.list)}
          variant={view === WorkflowsView.list ? 'default' : 'ghost'}
        >
          <List className="w-5 h-5" />
        </Button>
      </div>
    ) : null}
  </div>
)

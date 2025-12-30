import { useSearch } from '@shared/context'
import { Card } from '@shared/ui/card'
import { WorkflowShareFilters, WorkflowsView } from '@widgets/workflow/model'
import type { FC } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { HeroFilters } from './hero-filters'
import { SearchInput } from './search-input'

interface WorkflowsHeroProps {
  isPublic: boolean
  shareFilter: WorkflowShareFilters
  onShareFilterChange: (filter: WorkflowShareFilters) => void
  view: WorkflowsView
  onViewChange: (view: WorkflowsView) => void
  disabled?: boolean
  isMobile: boolean
}

export const WorkflowsHero: FC<WorkflowsHeroProps> = ({
  isPublic,
  shareFilter,
  onShareFilterChange,
  view,
  onViewChange,
  disabled,
  isMobile,
}) => {
  const { query, setQuery } = useSearch()
  const { formatMessage } = useIntl()

  return (
    <Card className="p-6 md:p-8 mb-4" glassEffect>
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-3xl font-bold text-center">
          {isPublic ? <FormattedMessage id="homePublicText" /> : <FormattedMessage id="homePrivateText" />}
        </h1>

        <div className="w-full max-w-2xl">
          <SearchInput onChange={setQuery} placeholder={formatMessage({ id: 'searchWorkflow' })} value={query} />
        </div>

        <HeroFilters
          disabled={disabled}
          isMobile={isMobile}
          isPublic={isPublic}
          onShareFilterChange={onShareFilterChange}
          onViewChange={onViewChange}
          shareFilter={shareFilter}
          view={view}
        />
      </div>
    </Card>
  )
}

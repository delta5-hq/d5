import { Tabs, TabsList, TabsTrigger } from '@shared/ui/tabs'
import { WorkflowShareFilters } from '@widgets/workflow/model'
import React from 'react'
import { FormattedMessage } from 'react-intl'

interface FilteringTagsProps {
  shareFilter: string
  setShareFilter: (filter: WorkflowShareFilters) => void
}

export const FilteringTags: React.FC<FilteringTagsProps> = ({ shareFilter, setShareFilter }) => (
  <Tabs className="w-full" onValueChange={value => setShareFilter(value as WorkflowShareFilters)} value={shareFilter}>
    <TabsList className="bg-card overflow-x-auto flex space-x-2">
      <TabsTrigger className="text-xs sm:text-base" value={WorkflowShareFilters.all}>
        <FormattedMessage id="tabAll" />
      </TabsTrigger>
      <TabsTrigger className="text-xs sm:text-base" value={WorkflowShareFilters.private}>
        <FormattedMessage id="tabPrivate" />
      </TabsTrigger>
      <TabsTrigger className="text-xs sm:text-base" value={WorkflowShareFilters.hidden}>
        <FormattedMessage id="tabPublicUnlisted" />
      </TabsTrigger>
      <TabsTrigger className="text-xs sm:text-base" value={WorkflowShareFilters.public}>
        <FormattedMessage id="tabPublic" />
      </TabsTrigger>
    </TabsList>
  </Tabs>
)

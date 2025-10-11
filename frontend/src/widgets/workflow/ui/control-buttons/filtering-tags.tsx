import { Tabs, TabsList, TabsTrigger } from '@shared/ui/tabs'
import { MapShareFilters } from '@widgets/workflow/model'
import React from 'react'
import { FormattedMessage } from 'react-intl'

interface FilteringTagsProps {
  shareFilter: string
  setShareFilter: (filter: MapShareFilters) => void
}

export const FilteringTags: React.FC<FilteringTagsProps> = ({ shareFilter, setShareFilter }) => (
  <Tabs className="w-full" onValueChange={value => setShareFilter(value as MapShareFilters)} value={shareFilter}>
    <TabsList className="bg-card overflow-x-auto flex space-x-2">
      <TabsTrigger className="text-xs sm:text-base" value={MapShareFilters.all}>
        <FormattedMessage id="tabAll" />
      </TabsTrigger>
      <TabsTrigger className="text-xs sm:text-base" value={MapShareFilters.private}>
        <FormattedMessage id="tabPrivate" />
      </TabsTrigger>
      <TabsTrigger className="text-xs sm:text-base" value={MapShareFilters.hidden}>
        <FormattedMessage id="tabPublicUnlisted" />
      </TabsTrigger>
      <TabsTrigger className="text-xs sm:text-base" value={MapShareFilters.public}>
        <FormattedMessage id="tabPublic" />
      </TabsTrigger>
    </TabsList>
  </Tabs>
)

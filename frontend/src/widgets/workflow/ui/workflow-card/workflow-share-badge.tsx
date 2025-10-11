import type { Share } from '@shared/base-types'
import { Badge } from '@shared/ui/badge'
import { MapShareFilters } from '@widgets/workflow'
import { getShareVisibility } from '@widgets/workflow/lib/getShareVisibility'
import type React from 'react'
import { FormattedMessage } from 'react-intl'

interface WorkflowShareBadgeProps {
  share?: Share
}

export const WorkflowShareBadge: React.FC<WorkflowShareBadgeProps> = ({ share }) => {
  const visibility = getShareVisibility(share)

  switch (visibility) {
    case MapShareFilters.public:
      return (
        <Badge className="bg-green-500/20 text-green-700 border-green-300" variant="outline">
          <FormattedMessage id="workflowIsPublic" />
        </Badge>
      )

    case MapShareFilters.hidden:
      return (
        <Badge className="bg-green-500/20 text-green-700 border-green-300" variant="outline">
          <FormattedMessage id="workflowIsHidden" />
        </Badge>
      )

    case MapShareFilters.private:
    default:
      return (
        <Badge className="bg-gray-200 text-gray-700 border-gray-300" variant="outline">
          <FormattedMessage id="workflowIsPrivate" />
        </Badge>
      )
  }
}

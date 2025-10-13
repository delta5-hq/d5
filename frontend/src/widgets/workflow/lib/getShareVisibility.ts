import type { Share } from '@shared/base-types'
import { WorkflowShareFilters } from '../model'

export function getShareVisibility(share?: Share): WorkflowShareFilters {
  if (share?.public?.hidden) {
    return WorkflowShareFilters.hidden
  } else if (share?.public?.enabled) {
    return WorkflowShareFilters.public
  }

  return WorkflowShareFilters.private
}

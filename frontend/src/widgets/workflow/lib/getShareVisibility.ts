import type { Share } from '@shared/base-types'
import { MapShareFilters } from '../model'

export function getShareVisibility(share?: Share): MapShareFilters {
  if (share?.public?.hidden) {
    return MapShareFilters.hidden
  } else if (share?.public?.enabled) {
    return MapShareFilters.public
  }

  return MapShareFilters.private
}

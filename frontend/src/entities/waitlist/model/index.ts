import type { FullUser } from '@shared/base-types'

export interface UserMapStatistics {
  _id: string
  mapCount?: number
  mapShareCount?: number
  nodeCount?: number
  edgeCount?: number
  mapIds?: string[]
  sharedWithCount?: number
  biggestMapCount?: number
  lastMapChange?: string
}

export interface FullUserStatistics extends FullUser {
  lastMapChange?: string
  biggestMapCount?: number | null
  mapCount: number
  mapShareCount: number
  sharedWithCount: number
  mapIds?: string[] | null
  sharedMaps?: number
  nodeCount: number
  edgeCount: number
}

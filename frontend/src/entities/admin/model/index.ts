import type { FullUser } from '@shared/base-types'

export interface UserWorkflowStatistics {
  _id: string
  mapId: string
  userId: string
  createdAt: string
  updatedAt: string
  mapNodeCount: number
  mapEdgeCount: number
  role: 'owner' | 'editor' | 'viewer' | string
  sharedWithCount: number
  public: boolean
  hidden: boolean
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

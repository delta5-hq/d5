import type { FullUser } from '@shared/base-types'

export interface UserWorkflowStatistics {
  _id: string
  workflowId: string
  userId: string
  createdAt: string
  updatedAt: string
  nodeCount: number
  edgeCount: number
  role: 'owner' | 'editor' | 'viewer' | string
  sharedWithCount: number
  public: boolean
  hidden: boolean
}

export interface FullUserStatistics extends FullUser {
  lastWorkflowChange?: string
  biggestWorkflowCount?: number | null
  workflowCount: number
  shareCount: number
  sharedWithCount: number
  workflowIds?: string[] | null
  sharedWorkflows?: number
  nodeCount: number
  edgeCount: number
}

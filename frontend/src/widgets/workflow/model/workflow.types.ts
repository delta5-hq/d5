import type { Share, Template } from '@shared/base-types'

export interface WorkflowItem {
  _id: string
  workflowId: string
  userId: string
  tags: string[]
  createdAt: string
  updatedAt: string
  __v: number
  root: string
  title: string
  share?: Share
  category?: string
}

export interface TemplateProperties {
  shownName?: string
  imageFit?: 'cover' | 'contain'
}

export interface TemplateItem extends Template {
  picture?: string
  properties?: TemplateProperties
}

export enum WorkflowsView {
  list = 'list',
  grid = 'grid',
}

export enum MapShareFilters {
  all = 'all',
  public = 'public',
  hidden = 'hidden',
  private = 'private',
}

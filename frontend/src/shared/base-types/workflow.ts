export type Dimensions = {
  height: number
  width: number
}

export type RectangleData = Dimensions & {
  x: number
  y: number
}

export type WorkflowId = string

export type NodeId = string

export type EdgeId = string

export type ObjectId = string

export type MediaPositions = 'crop' | 'body' | 'stretch'

export type NodeContent = {
  id?: NodeId
  children?: NodeId[]
  prompts?: NodeId[]
  image?: ObjectId
  uml?: ObjectId
  imagePosition?: MediaPositions
  video?: string
  file?: ObjectId
  title?: string
  color?: string
  borderColor?: string
  scale?: number
  tags?: string[]
  checked?: boolean
  hasComments?: boolean
  autoshrink?: boolean
  dirty?: boolean
  command?: string
}

export type NodeData = NodeContent & {
  id: NodeId
}

export type NodeDatas = Record<NodeId, NodeData>

export type EdgeContent = {
  id?: EdgeId
  start: NodeId
  end: NodeId
  title?: string
  color?: string
}

export type EdgeData = EdgeContent & {
  id: EdgeId
  title?: string
  color?: string
}

export type EdgeDatas = Record<EdgeId, EdgeData>

export type NodeTagId = string

export type NodeTagData = {
  id: NodeTagId
  name: string
  color: string
}

export type NodeTagDatas = NodeTagData[]

export type WorkflowContentData = {
  nodes: NodeDatas
  edges?: EdgeDatas
  root: NodeId
  tags?: NodeTagDatas
  share: Share
  category?: string
}

export interface Template extends Omit<WorkflowContentData, 'share' | 'category'> {
  _id: string
  name: string
  keywords: string[]
  backgroundImage: string
}

export enum AccessRole {
  owner = 'owner',
  contributor = 'contributor',
  reader = 'reader',
}

export interface RoleBinding {
  subjectId: string
  subjectType: 'user' | 'group' | 'mail'
  role: AccessRole
}

export interface PublicShare {
  enabled?: boolean
  hidden?: boolean
  writeable?: boolean
}

export interface Share {
  public?: PublicShare
  access: RoleBinding[]
}

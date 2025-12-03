type Locale = "en-US" | "ru-RU"

export interface Configuration {
  token: string
  color: string
  lang: Locale
  whitelabel: boolean
  popupIcon: string
  popupMessage: string
  windowHeading: string
  welcomeMessage: string
  addUnreadDot: boolean
  bottomIndent: number
  rightIndent: number
  zIndex: number
  buttonSize: number
  macroName: string
  autoOpen: boolean
}

export type ApiVersion = "/api/v2"

export interface DeltaFiveConfiguration {
  token: string
  apiVersion: ApiVersion
  streamGetAnswer: boolean
  sourcePattern: string
}

type Role = "system" | "user" | "assistant"

export interface MessageType {
  role: Role
  content: string
  requestId?: string
}

export type EventType = "TEST" | "POPUP_SEEN" | "POPUP_CALLED" | "POPUP_NO_ANSWER_CLIENT" | "POPUP_NO_ANSWER_SERVER"

export type LikeStatus = "good_answer" | "wrong_answer"

interface Localization {
  clear: string
  collapse: string
  resize: string
  send: string
  inputPlaceholder: string
  errorMessage: string
}

export type Localizations = {
  [key in Locale]: Localization
}

export type ReactionType = "LIKE" | "DISLIKE"

declare global {
  interface Window {
    deltaFiveQueryParams?: URLSearchParams
  }
}

export interface DeltaFiveApiParams {
  deltafiveConfiguration: DeltaFiveConfiguration
}

export type Dimensions = {
  height: number
  width: number
}

export type RectangleData = Dimensions & {
  x: number
  y: number
}

export type NodeId = string

export type EdgeId = string

export type ObjectId = string

export type MediaPositions = 'crop' | 'body' | 'stretch'

export interface GridOptions {
  rowData?: any[] | null
  columnDefs?: any[] | null
  filterModel?: {
    [key: string]: any
  }
  columnState?: any[]
}

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
  gridOptions?: GridOptions
  color?: string
  borderColor?: string
  scale?: number
  tags?: string[]
  checked?: boolean
  autoshrink?: boolean
  dirty?: boolean
  command?: string
  parent?: string
}

export type NodeData = NodeContent & {
  id: NodeId
}

export enum QUERY_TYPE {
  yandex = 'yandex',
  chat = 'chat',
  web = 'web',
  outline = 'outline',
  scholar = 'scholar',
  steps = 'steps',
  foreach = 'foreach',
  summarize = 'summarize',
}

export interface Macro {
  name: string
  keywords: string[]
  cell: NodeData
  queryType: QUERY_TYPE
  workflowNodes: Record<string, NodeData>
}
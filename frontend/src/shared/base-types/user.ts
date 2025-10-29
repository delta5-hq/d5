export interface User {
  id: string
  name: string
  mail: string
  createdAt: string
  updatedAt: string
  roles: string[]
}

export const ROLES = {
  subscriber: 'subscriber',
  org_subscriber: 'org_subscriber',
  customer: 'customer',
  administrator: 'administrator',
}

export interface FieldsOfWork {
  pupil?: string
  student?: string
  researcher?: string
  consultant?: string
  employee?: string
  freelancer?: string
  founder?: string
  other?: string
}

export interface StoreMeta {
  whatFor?: string
  fieldsOfWork?: FieldsOfWork
  studyPhase?: string
  researcherType?: string
  consultantType?: string
  companySize?: string
  getToKnow?: string
  phoneNumber?: string
  firstName?: string
  lastName?: string
}

export interface UserMeta {
  store?: StoreMeta
}

export interface FullUser {
  id: string
  name: string
  password?: string
  mail: string
  confirmed?: boolean
  roles?: string[]
  comment?: string
  limitNodes?: number
  limitWorkflows?: number
  pwdResetToken?: string
  meta?: UserMeta
  createdAt: string
}

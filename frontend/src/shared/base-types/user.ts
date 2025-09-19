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

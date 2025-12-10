/* Test user fixtures for E2E tests */
export const JWT_SECRET = 'test-jwt-secret-change-in-production'

export const ROLES = {
  subscriber: 'subscriber',
  org_subscriber: 'org_subscriber',
  customer: 'customer',
  administrator: 'administrator',
}

export const ACCESS_ROLES = {
  owner: 'owner',
  contributor: 'contributor',
  reader: 'reader',
}

export const subscriber = {
  name: 'subscriber',
  id: 'subscriber',
  mail: 'subscriber@dreaktor.com',
  password: 'P@ssw0rd!',
  roles: [ROLES.subscriber],
  limitWorkflows: 10,
  limitNodes: 300,
  confirmed: true,
}

export const customer = {
  name: 'customer',
  id: 'customer',
  mail: 'customer@dreaktor.com',
  password: 'P@ssw0rd!',
  roles: [ROLES.customer],
  limitWorkflows: 10,
  limitNodes: 300,
  confirmed: true,
}

export const administrator = {
  name: 'admin',
  id: 'admin',
  mail: 'admin@dreaktor.com',
  password: 'P@ssw0rd!',
  roles: [ROLES.administrator],
  limitWorkflows: 0,
  limitNodes: 0,
  confirmed: true,
}

export const syncuser = {
  name: 'wp-sync-user',
  id: 'wp-sync-user',
  mail: 'sync@dreaktor.com',
  password: 'P@ssw0rd!',
  roles: [ROLES.administrator],
  limitWorkflows: 0,
  limitNodes: 0,
  confirmed: true,
}

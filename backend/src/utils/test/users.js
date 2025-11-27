import {ROLES} from '../../shared/config/constants'
import {SYNC_USER_ID} from '../../constants'

export const subscriber = {
  name: 'subscriber',
  id: 'subscriber',
  mail: 'subscriber@dreaktor.com',
  password: 'unused',
  roles: [ROLES.subscriber],
  limitWorkflows: 10,
  limitNodes: 300,
  confirmed: true,
}

export const org_subscriber = {
  name: 'org_subscriber',
  id: 'org_subscriber',
  mail: 'org_subscriber@dreaktor.com',
  password: 'unused',
  roles: [ROLES.org_subscriber],
  limitWorkflows: 0,
  limitNodes: 0,
}

export const subscriberSocket = {
  ...subscriber,
  mail: 'subscriber_socket@dreaktor.com',
  id: 'subscriber_socket',
  name: 'subscriber_socket',
}

export const customer = {
  id: 'customer',
  name: 'customer',
  mail: 'customer@dreaktor.com',
  password: 'unused',
  roles: [ROLES.customer],
  limitWorkflows: 10,
  limitNodes: 1500,
}

export const administrator = {
  id: 'admin',
  name: 'admin',
  mail: 'admin@dreaktor.com',
  password: 'unused',
  roles: [ROLES.subscriber, ROLES.administrator],
  limitWorkflows: 0,
  limitNodes: 0,
}

export const syncuser = {
  id: SYNC_USER_ID,
  name: SYNC_USER_ID,
  mail: 'sync@dreaktor.com',
}

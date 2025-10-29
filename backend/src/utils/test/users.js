import {ROLES} from '../../shared/config/constants'
import {SYNC_USER_ID} from '../../constants'

export const subscriber = {
  name: 'subscriber_user',
  id: 'subscriber_user',
  mail: 'subscriber@example.com',
  password: 'unused',
  roles: [ROLES.subscriber],
  limitWorkflows: 10,
  limitNodes: 300,
  confirmed: true,
}

export const org_subscriber = {
  name: 'org_subscriber_user',
  id: 'org_subscriber_user',
  mail: 'org_subscriber@example.com',
  password: 'unused',
  roles: [ROLES.org_subscriber],
  limitWorkflows: 0,
  limitNodes: 0,
}

export const subscriberSocket = {
  ...subscriber,
  mail: 'subscriber_user_socket@example.com',
  id: 'subscriber_user_socket',
  name: 'subscriber_user_socket',
}

export const customer = {
  id: 'customer_user',
  name: 'customer_user',
  mail: 'customer@example.com',
  password: 'unused',
  roles: [ROLES.customer],
  limitWorkflows: 10,
  limitNodes: 1500,
}

export const administrator = {
  id: 'administrator_user',
  name: 'administrator_user',
  mail: 'administrator@example.com',
  password: 'unused',
  roles: [ROLES.subscriber, ROLES.administrator],
  limitWorkflows: 0,
  limitNodes: 0,
}

export const syncuser = {
  id: SYNC_USER_ID,
  name: SYNC_USER_ID,
  mail: 'sync@example.com',
}

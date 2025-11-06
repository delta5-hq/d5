/* Reserved E2E test user identifiers - NEVER use in production */
export const E2E_TEST_USERS = [
  'subscriber_user',
  'customer_user',
  'administrator_user',
  'org_subscriber_user',
  'subscriber_user_socket',
]

/* Reserved E2E test name prefix */
export const E2E_PREFIX = 'e2e_test_'

/* Check if identifier is reserved for E2E tests */
export const isE2ETestUser = (userId) => E2E_TEST_USERS.includes(userId)
export const isE2ETestObject = (name) => name?.startsWith?.(E2E_PREFIX)

/* Layer 1: User pool filter (primary - fast indexed lookup) */
export const testUserFilter = () => ({userId: {$in: E2E_TEST_USERS}})
export const testIdFilter = () => ({id: {$in: E2E_TEST_USERS}})

/* Layer 2: Prefix filter (fallback - catches dynamic names) */
export const testPrefixFilter = (field = 'name') => ({
  [field]: {$regex: `^${E2E_PREFIX}`},
})

/* Hybrid: Both layers (comprehensive safety) */
export const testHybridFilter = (userField = 'userId', nameField = 'name') => ({
  $or: [
    {[userField]: {$in: E2E_TEST_USERS}},
    {[nameField]: {$regex: `^${E2E_PREFIX}`}},
  ],
})

/**
 * Global E2E Test Teardown
 * 
 * Closes MongoDB connection after all tests complete.
 */

import {closeDb} from '../src/db'

export default async function globalTeardown() {
  console.log('[E2E TEARDOWN] Closing MongoDB connection...')
  await closeDb()
  console.log('[E2E TEARDOWN] MongoDB connection closed')
}

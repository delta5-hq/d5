/**
 * Global E2E Test Teardown
 * 
 * No cleanup needed - backend-v2 handles MongoDB connection.
 */

export default async function globalTeardown() {
  console.log('[E2E TEARDOWN] Tests complete')
}

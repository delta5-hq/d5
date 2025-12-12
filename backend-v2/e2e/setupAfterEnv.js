/**
 * E2E Test Environment Setup (runs in test process)
 * 
 * MongoDB connection handled by backend-v2 server process.
 * Tests connect via HTTP only.
 */

/* No MongoDB connection needed - tests use HTTP API only */
beforeAll(async () => {
  console.log('[E2E ENV] Tests will connect to backend-v2 via HTTP')
}, 30000)

/**
 * Global E2E Test Setup
 * 
 * Runs once before all test suites in separate process.
 * Note: Mongoose connection here does NOT persist to test process.
 */

export default async function globalSetup() {
  console.log('[E2E SETUP] Global setup complete')
}

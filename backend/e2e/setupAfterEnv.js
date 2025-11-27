/**
 * E2E Test Environment Setup (runs in test process)
 * 
 * This runs AFTER Jest environment is set up but BEFORE any test files.
 * Ensures MongoDB connection exists in the same process as tests.
 */

import {connectDb} from '../src/db'

beforeAll(async () => {
  console.log('[E2E ENV] Connecting MongoDB in test process...')
  await connectDb()
  console.log('[E2E ENV] MongoDB connected in test process')
}, 30000)

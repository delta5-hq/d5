import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

dotenv.config()

const PARALLEL_USER_COUNT = 2

const E2E_BASE_URL = process.env.E2E_BASE_URL
if (!E2E_BASE_URL) {
  throw new Error(
    'E2E_BASE_URL is required and must point at the e2e frontend (e.g. http://localhost:5174). ' +
      'Run e2e through `make e2e-frontend` (or set E2E_BASE_URL explicitly). ' +
      'No default fallback — defaulting to the dev frontend has wiped dev Mongo through the shared backend.',
  )
}

export default defineConfig({
  testDir: './e2e',
  timeout: process.env.CI ? 120000 : 60000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: PARALLEL_USER_COUNT,
  reporter: process.env.CI ? [['list'], ['junit', { outputFile: 'junit.xml' }]] : 'html',
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: process.env.CI ? 30000 : 10000,
    navigationTimeout: process.env.CI ? 60000 : 30000,
    headless: true,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
})

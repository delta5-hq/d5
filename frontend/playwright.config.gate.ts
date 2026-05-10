import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

dotenv.config()

const PARALLEL_USER_COUNT = 2

export default defineConfig({
  testDir: './e2e',
  timeout: process.env.CI ? 120000 : 60000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: PARALLEL_USER_COUNT,
  reporter: process.env.CI ? [['list'], ['junit', { outputFile: 'junit.xml' }]] : 'html',
  testIgnore: [
    '**/auth-network-errors.spec.ts',
    '**/workflow-sharing-network-errors.spec.ts',
    '**/dual-sidebar-navigation.spec.ts',
    '**/command-autocomplete.spec.ts',
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
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

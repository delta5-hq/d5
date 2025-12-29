import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

dotenv.config()

/* Slow CI throttling config - simulates resource-constrained runners */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 2,
  workers: 1,
  timeout: 120000,
  reporter: [['list'], ['junit', { outputFile: 'junit.xml' }], ['html']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20000,
    navigationTimeout: 60000,
    headless: true,
    launchOptions: {
      slowMo: 50,
    },
  },

  projects: [
    {
      name: 'chromium-throttled',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        launchOptions: {
          slowMo: 50,
          args: [
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-setuid-sandbox',
            '--no-sandbox',
          ],
        },
        contextOptions: {
          reducedMotion: 'reduce',
        },
      },
    },
  ],
})

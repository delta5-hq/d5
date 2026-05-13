import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/fixtures',
  testMatch: '**/*.test.ts',
  timeout: 10000,
  fullyParallel: true,
  use: {
    baseURL: 'http://localhost:5174',
  },
})

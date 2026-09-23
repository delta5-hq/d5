import { expect, test } from '@playwright/test'
import primaryConfig from '../playwright.config'
import throttledConfig from '../playwright.config.throttled'

type PlaywrightConfigShape = {
  projects?: Array<{ name?: string }>
  retries?: number
  use?: {
    baseURL?: string
    screenshot?: string
    trace?: string
    video?: string
  }
  workers?: number
}

const configured = (config: unknown): PlaywrightConfigShape => config as PlaywrightConfigShape

const runningUnderCi = Boolean(process.env.CI)

const expectedBaseUrl = () => {
  expect(process.env.E2E_BASE_URL).toBeTruthy()
  return process.env.E2E_BASE_URL
}

test.describe('Playwright config contract - frontend e2e evidence capture', () => {
  test('primary config keeps bounded failure evidence and drops video only under CI', () => {
    const config = configured(primaryConfig)

    expect(config.use?.baseURL).toBe(expectedBaseUrl())
    expect(config.use?.trace).toBe('on-first-retry')
    expect(config.use?.screenshot).toBe('only-on-failure')
    expect(config.use?.video).toBe(runningUnderCi ? 'off' : 'retain-on-failure')
  })

  test('primary config runs the reliability gate across chromium and firefox with two workers', () => {
    const config = configured(primaryConfig)

    expect(config.workers).toBe(2)
    expect(config.retries).toBe(runningUnderCi ? 1 : 0)
    expect(config.projects?.map(project => project.name)).toEqual(['chromium', 'firefox'])
  })

  test('throttled config preserves first-retry traces, failure screenshots, and retained failure video', () => {
    const config = configured(throttledConfig)

    expect(config.use?.baseURL).toBe(expectedBaseUrl())
    expect(config.use?.trace).toBe('on-first-retry')
    expect(config.use?.screenshot).toBe('only-on-failure')
    expect(config.use?.video).toBe('retain-on-failure')
  })

  test('throttled config stays single-worker and retry-rich for constrained local reproduction', () => {
    const config = configured(throttledConfig)

    expect(config.workers).toBe(1)
    expect(config.retries).toBe(2)
    expect(config.projects?.map(project => project.name)).toEqual(['chromium-throttled'])
  })
})

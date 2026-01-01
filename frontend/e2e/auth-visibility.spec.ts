import { test, expect } from '@playwright/test'
import { adminLogin } from './utils'

test.describe('Auth controls visibility', () => {
  test.describe('Unauthenticated state', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/')
      await page.evaluate(() => {
        localStorage.clear()
        sessionStorage.clear()
      })
      await page.goto('/')
      await page.waitForLoadState('networkidle')
    })

    test('login button visible in header across all viewports', async ({ page }) => {
      const viewports = [
        { width: 1280, height: 720, name: 'desktop' },
        { width: 768, height: 800, name: 'tablet' },
        { width: 375, height: 667, name: 'mobile' },
      ]

      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await page.waitForTimeout(300)

        const loginButton = page.locator('[data-type="login"]').first()
        await expect(loginButton).toBeVisible()

        const allLoginButtons = page.locator('[data-type="login"]')
        await expect(allLoginButtons).toHaveCount(1)
      }
    })

    test('viewport transitions preserve login button', async ({ page }) => {
      await page.locator('[data-type="login"]').first().waitFor({ state: 'visible' })

      await page.setViewportSize({ width: 375, height: 667 })
      await page.waitForTimeout(300)
      await expect(page.locator('[data-type="login"]')).toBeVisible()
      await expect(page.locator('[data-type="login"]')).toHaveCount(1)

      await page.setViewportSize({ width: 768, height: 800 })
      await page.waitForTimeout(300)
      await expect(page.locator('[data-type="login"]')).toBeVisible()
      await expect(page.locator('[data-type="login"]')).toHaveCount(1)

      await page.setViewportSize({ width: 1280, height: 720 })
      await page.waitForTimeout(300)
      await expect(page.locator('[data-type="login"]')).toBeVisible()
      await expect(page.locator('[data-type="login"]')).toHaveCount(1)
    })
  })

  test.describe('Authenticated state', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/')
      await adminLogin(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')
    })
  })
})

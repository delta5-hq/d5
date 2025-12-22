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
      await page.goto('/workflows')
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

        await page.locator('[data-type="login"]').first().waitFor({ state: 'visible' })

        const headerLoginButton = page.locator('header [data-type="login"]')
        await expect(headerLoginButton).toBeVisible()

        const allLoginButtons = page.locator('[data-type="login"]')
        await expect(allLoginButtons).toHaveCount(1)
      }
    })

    test('mobile sidebar does not contain login button', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })

      await page.locator('[data-type="login"]').first().waitFor({ state: 'visible' })

      const toggleButton = page.locator('[data-sidebar="trigger"]')
      await toggleButton.click()

      const sidebar = page.locator('[data-slot="sidebar"]')
      await expect(sidebar).toBeVisible()

      const sidebarLoginButton = page.locator('[data-slot="sidebar"] [data-type="login"]')
      await expect(sidebarLoginButton).toHaveCount(0)

      const headerLoginButton = page.locator('header [data-type="login"]')
      await expect(headerLoginButton).toBeVisible()
    })

    test('viewport transitions preserve login button', async ({ page }) => {
      await page.locator('[data-type="login"]').first().waitFor({ state: 'visible' })

      await page.setViewportSize({ width: 375, height: 667 })
      await expect(page.locator('header [data-type="login"]')).toBeVisible()
      await expect(page.locator('[data-type="login"]')).toHaveCount(1)

      await page.setViewportSize({ width: 768, height: 800 })
      await expect(page.locator('header [data-type="login"]')).toBeVisible()
      await expect(page.locator('[data-type="login"]')).toHaveCount(1)

      await page.setViewportSize({ width: 1280, height: 720 })
      await expect(page.locator('header [data-type="login"]')).toBeVisible()
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

    test('desktop shows user controls, no login button', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 })
      await page.goto('/workflows')

      await expect(page.locator('[data-type="login"]')).toHaveCount(0)
      await expect(page.locator('[data-type="user-settings"]')).toBeVisible()
      await expect(page.locator('button:has(svg.lucide-circle-question-mark)')).toBeVisible()
    })

    test('mobile shows create workflow, no login button', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/workflows')

      await expect(page.locator('[data-type="login"]')).toHaveCount(0)
      await expect(page.getByRole('button', { name: /create.*workflow/i })).toBeVisible()
    })

    test('mobile sidebar shows user controls when authenticated', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/workflows')

      const toggleButton = page.locator('[data-sidebar="trigger"]')
      await toggleButton.click()

      const sidebar = page.locator('[data-slot="sidebar"]')
      await expect(sidebar).toBeVisible()

      await expect(sidebar.locator('[data-type="user-settings"]')).toBeVisible()
      await expect(sidebar.locator('button:has(svg.lucide-circle-question-mark)')).toBeVisible()

      await expect(page.locator('[data-type="login"]')).toHaveCount(0)
    })
  })
})

import { test, expect } from '@playwright/test'
import { adminLogin } from './utils'

test.describe('Sidebar navigation active states', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await adminLogin(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test.describe('Parent route highlighting', () => {
    test('highlights parent menu for exact match', async ({ page }) => {
      const adminUsersLink = page.locator('[data-sidebar="menu-button"]', { hasText: 'User Stats' })
      await adminUsersLink.click()
      await page.waitForURL('/admin/users')

      const activeMenuItem = page.locator('[data-sidebar="menu-item"]', {
        has: page.locator('[data-sidebar="menu-button"]', { hasText: 'User Stats' }),
      })

      await expect(activeMenuItem).toHaveClass(/menuLinkButton/)
    })

    test('highlights parent menu when viewing child route', async ({ page }) => {
      await page.goto('/admin/users')
      await page.waitForLoadState('networkidle')

      const userRows = page.locator('table tbody tr')
      const userRowCount = await userRows.count()

      if (userRowCount > 0) {
        await userRows.first().click()
        await page.waitForURL(/\/admin\/users\/[^/]+$/)

        const activeMenuItem = page.locator('[data-sidebar="menu-item"]', {
          has: page.locator('[data-sidebar="menu-button"]', { hasText: 'User Stats' }),
        })

        await expect(activeMenuItem).toHaveClass(/menuLinkButton/)
      }
    })

    test('does not highlight sibling routes', async ({ page }) => {
      await page.goto('/admin/users')
      await page.waitForLoadState('networkidle')

      const waitlistMenuItem = page.locator('[data-sidebar="menu-item"]', {
        has: page.locator('[data-sidebar="menu-button"]', { hasText: 'Waitlist' }),
      })

      await expect(waitlistMenuItem).not.toHaveClass(/menuLinkButton/)
    })
  })

  test.describe('Route matching edge cases', () => {
    test('does not match similar route prefixes', async ({ page }) => {
      await page.goto('/workflows/public')
      await page.waitForLoadState('networkidle')

      const myWorkflowsMenuItem = page.locator('[data-sidebar="menu-item"]', {
        has: page.locator('[data-sidebar="menu-button"]', { hasText: 'My Workflows' }),
      })

      const myWorkflowsClass = await myWorkflowsMenuItem.getAttribute('class')
      const isMyWorkflowsActive = myWorkflowsClass?.includes('menuLinkButton') || false

      expect(isMyWorkflowsActive).toBe(false)
    })

    test('highlights correct menu across nested routes', async ({ page }) => {
      await page.goto('/settings')
      await page.waitForLoadState('networkidle')

      const settingsMenuItem = page.locator('[data-sidebar="menu-item"]', {
        has: page.locator('[data-sidebar="menu-button"]', { hasText: 'Settings' }),
      })

      await expect(settingsMenuItem).toHaveClass(/menuLinkButton/)
    })
  })

  test.describe('Navigation consistency', () => {
    test('updates active state on navigation', async ({ page }) => {
      await page.goto('/workflows')
      await page.waitForLoadState('networkidle')

      let myWorkflowsMenuItem = page.locator('[data-sidebar="menu-item"]', {
        has: page.locator('[data-sidebar="menu-button"]', { hasText: 'My Workflows' }),
      })
      await expect(myWorkflowsMenuItem).toHaveClass(/menuLinkButton/)

      await page.goto('/settings')
      await page.waitForLoadState('networkidle')

      myWorkflowsMenuItem = page.locator('[data-sidebar="menu-item"]', {
        has: page.locator('[data-sidebar="menu-button"]', { hasText: 'My Workflows' }),
      })
      await expect(myWorkflowsMenuItem).not.toHaveClass(/menuLinkButton/)

      const settingsMenuItem = page.locator('[data-sidebar="menu-item"]', {
        has: page.locator('[data-sidebar="menu-button"]', { hasText: 'Settings' }),
      })
      await expect(settingsMenuItem).toHaveClass(/menuLinkButton/)
    })

    test('maintains active state on page reload', async ({ page }) => {
      await page.goto('/admin/users')
      await page.waitForLoadState('networkidle')

      await page.reload()
      await page.waitForLoadState('networkidle')

      const activeMenuItem = page.locator('[data-sidebar="menu-item"]', {
        has: page.locator('[data-sidebar="menu-button"]', { hasText: 'User Stats' }),
      })

      await expect(activeMenuItem).toHaveClass(/menuLinkButton/)
    })
  })

  test.describe('Multi-level navigation', () => {
    test('maintains parent highlight when navigating between child routes', async ({ page }) => {
      await page.goto('/admin/users')
      await page.waitForLoadState('networkidle')

      const userRows = page.locator('table tbody tr')
      const userRowCount = await userRows.count()

      if (userRowCount > 0) {
        await userRows.first().click()
        await page.waitForURL(/\/admin\/users\/[^/]+$/)

        const activeMenuItem = page.locator('[data-sidebar="menu-item"]', {
          has: page.locator('[data-sidebar="menu-button"]', { hasText: 'User Stats' }),
        })
        await expect(activeMenuItem).toHaveClass(/menuLinkButton/)

        await page.goBack()
        await page.waitForURL('/admin/users')

        await expect(activeMenuItem).toHaveClass(/menuLinkButton/)
      }
    })
  })
})

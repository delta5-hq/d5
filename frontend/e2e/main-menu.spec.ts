import { test, expect } from '@playwright/test'
import { adminLogin, setupUnauthenticatedPage } from './utils'

test.describe('Main navigation (desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await adminLogin(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('sees at least one main menu item', async ({ page }) => {
    const menuItems = page.locator('[data-sidebar="menu-button"]')
    await expect(menuItems.first()).toBeVisible()
  })

  test('opens user menu, sees at least one item', async ({ page }) => {
    const userMenuButton = page.locator('[data-type="user-settings"]')
    await userMenuButton.click()

    const accountSettings = page.getByRole('menuitem', { name: 'Settings' })
    await expect(accountSettings).toBeVisible()
  })

  test('opens help menu, sees at least one item', async ({ page }) => {
    const helpMenuButton = page.locator('button:has(svg.lucide-circle-question-mark)')
    await helpMenuButton.click()

    const accountSettings = page.getByText('Help & Support', { exact: true })
    await expect(accountSettings).toBeVisible()
  })
})

test.describe('Sidebar behavior (tablet width)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 800 })
    await setupUnauthenticatedPage(page)
    await page.goto('/')
  })

  test('sidebar state persists through toggle cycle', async ({ page }) => {
    const toggleButton = page.locator('[data-sidebar="trigger"]')
    const sidebar = page.locator('[data-slot="sidebar"]')

    await expect(sidebar).toHaveAttribute('data-state', 'collapsed')

    await toggleButton.click()
    await expect(sidebar).toHaveAttribute('data-state', 'expanded')

    await toggleButton.click()
    await expect(sidebar).toHaveAttribute('data-state', 'collapsed')
  })

  test('sidebar maintains expanded state after page reload', async ({ page }) => {
    const toggleButton = page.locator('[data-sidebar="trigger"]')
    const sidebar = page.locator('[data-slot="sidebar"]')

    await toggleButton.click()
    await expect(sidebar).toHaveAttribute('data-state', 'expanded')

    await page.reload()
    await expect(sidebar).toHaveAttribute('data-state', 'expanded')
  })
})

test.describe('Sidebar behavior (mobile width)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await setupUnauthenticatedPage(page)
    await page.goto('/')
  })

  test('sidebar hidden by default and expands on trigger click', async ({ page }) => {
    const toggleButton = page.locator('[data-sidebar="trigger"]')
    const sidebar = page.locator('[data-slot="sidebar"]')

    await expect(sidebar).not.toBeVisible()

    await toggleButton.click()
    await expect(sidebar).toBeVisible()
    await expect(sidebar).toHaveAttribute('data-state', 'expanded')
  })

  test('sidebar closes on Escape key', async ({ page }) => {
    const toggleButton = page.locator('[data-sidebar="trigger"]')
    const sidebar = page.locator('[data-slot="sidebar"]')

    await toggleButton.click()
    await expect(sidebar).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(sidebar).not.toBeVisible()
  })
})

test.describe('Sidebar behavior (desktop width)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await adminLogin(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('trigger button is hidden on desktop', async ({ page }) => {
    const toggleButton = page.locator('[data-sidebar="trigger"]')
    await expect(toggleButton).not.toBeVisible()
  })

  test('sidebar is always visible on desktop', async ({ page }) => {
    const sidebar = page.locator('[data-slot="sidebar"]')
    await expect(sidebar).toBeVisible()
  })
})
